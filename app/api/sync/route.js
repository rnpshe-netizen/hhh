// 구글 시트 → pending_syncs 대기 테이블에 저장 (관리자 승인 후 반영)
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getGoogleAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function formatPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.length === 11) return digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7);
  if (digits.length === 10) return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
  return digits;
}

export async function POST(request) {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const sheetTab = process.env.GOOGLE_SHEET_TAB || 'Form_Responses';
    if (!sheetId) return NextResponse.json({ error: 'GOOGLE_SHEET_ID 환경변수 미설정' }, { status: 500 });
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY 환경변수 미설정' }, { status: 500 });

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 시트 탭 이름 자동 감지
    let actualTab = sheetTab;
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const sheetNames = meta.data.sheets.map(s => s.properties.title);
      actualTab = sheetNames.find(n => n === sheetTab) || sheetNames[0];
    } catch (e) {
      return NextResponse.json({ error: '시트 접근 실패: ' + e.message }, { status: 500 });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${actualTab}!A:N`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ message: '동기화할 새 데이터가 없습니다.', created: 0 });
    }

    const dataRows = rows.slice(1);
    let created = 0;
    let skipped = 0;
    let errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;

      // N열이 TRUE면 이미 처리 완료
      if (row[14] === 'TRUE') { skipped++; continue; } // O열: 동기화여부

      // 컬럼 매핑 (2026-04-04 구글 폼 업데이트 반영)
      // A:Timestamp B:이름한글 C:이름영문 D:생년월일 E:연락처 F:이메일 G:주소
      // H:신청과정 I:신청일정 J:참가비확인 K:재수강 L:추가수료증 M:보유자격 N:기타 O:동기화
      const name = (row[1] || '').trim();
      const nameEn = (row[2] || '').trim();
      const birthDate = (row[3] || '').trim();
      const phone = formatPhone(row[4]);
      const email = (row[5] || '').trim();
      const address = (row[6] || '').trim();
      const courseName = (row[7] || '').trim();
      const scheduleText = (row[8] || '').trim();  // I열: 신청 일정
      const isRetake = (row[10] || '').includes('재수강'); // K열
      const extraCert = (row[11] || '').trim();  // L열
      const currentCert = (row[12] || '').trim(); // M열
      const note = (row[13] || '').trim();  // N열

      if (!name) { skipped++; continue; }

      const formData = {
        name, nameEn, birthDate, phone, email, address,
        courseName, scheduleText, isRetake, extraCert, currentCert, note,
        timestamp: row[0] || '',
      };

      // 이미 pending_syncs에 같은 행이 있으면 건너뜀
      const { data: existingSync } = await supabase.from('pending_syncs')
        .select('id').eq('sheet_row', rowNum).limit(1);
      if (existingSync && existingSync.length > 0) { skipped++; continue; }

      // 기존 회원 검색 (이름 + 전화번호)
      let existingMember = null;
      if (phone) {
        const { data } = await supabase.from('members')
          .select('id, name, phone, email, memo')
          .eq('name', name).eq('phone', phone).limit(1);
        if (data && data.length > 0) existingMember = data[0];
      }

      if (existingMember) {
        // 기존 회원 → 변경사항 비교
        const changes = [];

        if (email && email !== existingMember.email) {
          changes.push({ field: 'email', label: '이메일', old: existingMember.email || '없음', new: email, approved: null });
        }
        if (address) {
          const existingMemo = existingMember.memo || '';
          const existingAddr = existingMemo.match(/주소: ([^/]+)/)?.[1]?.trim();
          if (address !== existingAddr) {
            changes.push({ field: 'address', label: '주소', old: existingAddr || '없음', new: address, approved: null });
          }
        }
        if (nameEn) {
          const existingMemo = existingMember.memo || '';
          const existingNameEn = existingMemo.match(/영문: ([^/]+)/)?.[1]?.trim();
          if (nameEn !== existingNameEn) {
            changes.push({ field: 'nameEn', label: '영문이름', old: existingNameEn || '없음', new: nameEn, approved: null });
          }
        }
        // 신청 과정은 항상 변경사항에 포함
        if (courseName) {
          changes.push({ field: 'course', label: '신청 과정', old: null, new: courseName, approved: null, isRetake, scheduleText });
        }

        const { error } = await supabase.from('pending_syncs').insert([{
          sheet_row: rowNum,
          member_id: existingMember.id,
          sync_type: 'update',
          form_data: formData,
          changes,
          status: 'pending',
        }]);

        if (error) { errors.push({ row: rowNum, name, error: error.message }); }
        else { created++; }

      } else {
        // 신규 회원
        // 이름만 같은 유사 회원 검색 (동명이인 가능성)
        const { data: similarMembers } = await supabase.from('members')
          .select('id, name, phone, email').eq('name', name).limit(5);

        const changes = [];
        if (courseName) {
          changes.push({ field: 'course', label: '신청 과정', old: null, new: courseName, approved: null, isRetake, scheduleText });
        }

        const { error } = await supabase.from('pending_syncs').insert([{
          sheet_row: rowNum,
          member_id: null,
          sync_type: similarMembers && similarMembers.length > 0 ? 'similar' : 'new',
          form_data: formData,
          changes,
          status: 'pending',
        }]);

        if (error) { errors.push({ row: rowNum, name, error: error.message }); }
        else { created++; }
      }

      // 시트에 처리 완료 표시
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${actualTab}!O${rowNum}`, // O열: 동기화여부
          valueInputOption: 'RAW',
          requestBody: { values: [['TRUE']] },
        });
      } catch (e) {}
    }

    return NextResponse.json({ success: true, created, skipped, errors: errors.length > 0 ? errors : undefined, total: dataRows.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

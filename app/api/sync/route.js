// 구글 시트 → Supabase 회원 동기화 API
// 구글 폼 응답 시트에서 새 신청 건을 읽어 members 테이블에 등록
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 구글 서비스 계정 인증
function getGoogleAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// 전화번호 정규화 (하이픈 추가)
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
    if (!sheetId) {
      return NextResponse.json({ error: 'GOOGLE_SHEET_ID 환경변수가 설정되지 않았습니다.' }, { status: 500 });
    }
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_KEY 환경변수가 설정되지 않았습니다.' }, { status: 500 });
    }

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // 디버그: 먼저 스프레드시트 메타데이터로 시트 목록 확인
    let sheetNames = [];
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      sheetNames = meta.data.sheets.map(s => s.properties.title);
    } catch (metaErr) {
      return NextResponse.json({ error: '시트 접근 실패: ' + metaErr.message, sheetId, sheetTab }, { status: 500 });
    }

    // 실제 시트 탭 이름으로 자동 매칭 (정확한 이름 사용)
    const actualTab = sheetNames.find(n => n === sheetTab) || sheetNames[0];

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${actualTab}!A:N`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ message: '동기화할 새 데이터가 없습니다.', synced: 0 });
    }

    // 첫 행은 헤더, 나머지가 데이터
    const header = rows[0];
    const dataRows = rows.slice(1);

    let synced = 0;
    let skipped = 0;
    let errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 시트 기준 행 번호

      // N열 (동기화여부)이 TRUE면 이미 처리된 건 → 건너뜀
      if (row[13] === 'TRUE') {
        skipped++;
        continue;
      }

      const name = (row[1] || '').trim();        // B: 이름(한글)
      const nameEn = (row[2] || '').trim();       // C: 이름(영문)
      const birthDate = (row[3] || '').trim();    // D: 생년월일
      const phone = formatPhone(row[4]);           // E: 연락처
      const email = (row[5] || '').trim();         // F: 이메일
      const address = (row[6] || '').trim();       // G: 주소
      const courseName = (row[7] || '').trim();    // H: 신청과정
      const isRetake = (row[9] || '').includes('재수강'); // J: 재수강여부

      if (!name) {
        skipped++;
        continue;
      }

      // 중복 체크 (이름 + 연락처 기준)
      let existingMember = null;
      if (phone) {
        const { data } = await supabase.from('members')
          .select('id, name')
          .eq('name', name)
          .eq('phone', phone)
          .limit(1);
        if (data && data.length > 0) existingMember = data[0];
      }

      if (existingMember) {
        // 기존 회원 → 이메일/주소 업데이트만 (덮어쓰기)
        const updates = {};
        if (email && !existingMember.email) updates.email = email;
        if (Object.keys(updates).length > 0) {
          await supabase.from('members').update(updates).eq('id', existingMember.id);
        }
        skipped++;
      } else {
        // 신규 회원 등록
        const { data, error } = await supabase.from('members').insert([{
          name,
          phone,
          email: email || null,
          memo: [
            nameEn ? `영문: ${nameEn}` : '',
            birthDate ? `생년월일: ${birthDate}` : '',
            address ? `주소: ${address}` : '',
            courseName ? `신청과정: ${courseName}` : '',
            isRetake ? '재수강' : '',
          ].filter(Boolean).join(' / '),
        }]).select();

        if (error) {
          errors.push({ row: rowNum, name, error: error.message });
        } else {
          synced++;
        }
      }

      // 동기화 완료 표시 (N열에 TRUE 기록)
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${actualTab}!N${rowNum}`,
          valueInputOption: 'RAW',
          requestBody: { values: [['TRUE']] },
        });
      } catch (e) {
        // 시트 쓰기 실패해도 DB 등록은 유지
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      total: dataRows.length,
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

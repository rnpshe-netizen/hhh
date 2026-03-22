require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 파일 이름과 미리 생성된 Course 테이블의 이름을 매핑합니다.
const COURSE_MAPPING = {
  "1. TRAIN 기초 수료증 발급 현황.xlsx": "TRAIN 기초",
  "2. TRAIN 심화 수료증 발급 대장.xls": "TRAIN 심화",
  "3. TRAIN Advanced 수료증 발급 대장.xls": "TRAIN Advanced",
  "4. TRAIN (기초+심화) 수료증 발급 대장.xls": "TRAIN 기초+심화",
  "5. 가족코칭 전문가 수료증 발급대장.xls": "가족코칭 전문가",
  "6. 가족코칭지도사 2급 자격증 발급 대장.xls": "가족코칭지도사 2급",
  "7. 라이프코칭  수료증 발급 대장.xls": "라이프코칭"
};

// 엑셀 날짜 형식을 JavasScript Date 스트링(YYYY-MM-DD)으로 변환하는 유틸리티
function parseExcelDate(d) {
  if (!d) return null;
  if (typeof d === 'number') {
    // 엑셀 날짜 일련번호 처리 (1900년 기준)
    const date = new Date(Math.round((d - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  if (typeof d === 'string') {
    // 한글 제거 및 . / - 를 - 로 통일
    let s = d.replace(/[년월일\/\.]/g, '-').trim();
    // 여러 개의 - 를 1개로, 끝부분 - 제거
    s = s.replace(/-+/g, '-').replace(/-$/, '');
    
    const parts = s.split('-');
    if (parts.length >= 3) {
      const y = parts[0].replace(/[^0-9]/g, '');
      const m = parts[1].replace(/[^0-9]/g, '').padStart(2, '0');
      const d2 = parts[2].replace(/[^0-9]/g, '').padStart(2, '0');
      
      const mon = parseInt(m, 10);
      const day = parseInt(d2, 10);
      if (y.length === 4 && mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
        return `${y}-${m}-${d2}`;
      }
    }
    return null;
  }
  return null;
}

async function main() {
  console.log("🚀 엑셀 데이터 DB 이관 스크립트 시작...");

  // 1. DB에서 Course 목록 불러오기
  const { data: courses, error: courseErr } = await supabase.from('courses').select('*');
  if (courseErr) {
    console.error("Course 로드 실패:", courseErr);
    return;
  }
  console.log(`✅ ${courses.length}개의 과정 정보를 Supabase에서 불러왔습니다.`);

  const courseMap = {};
  courses.forEach(c => { courseMap[c.name] = c.id; });

  const refDir = path.join(__dirname, '../references');
  const files = fs.readdirSync(refDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));

  const parsedCompletions = []; // { courseName, name, regNo, issueDate, cohort, note }
  const uniqueNames = new Set();

  // 2. 7개 엑셀 파일 순회하며 데이터 동적 파싱
  for (const file of files) {
    const courseName = Object.keys(COURSE_MAPPING).find(k => file.includes(k.substring(0, 10))) ? COURSE_MAPPING[file] : null;
    if (!courseName) {
      console.warn(`⚠️ 알 수 없는 파일: ${file}`);
      continue;
    }

    console.log(`\n📂 파일 처리 중: ${file} -> 과정명: [${courseName}]`);
    const wb = XLSX.readFile(path.join(refDir, file));

    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      
      let headerIndices = null;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // 헤더 행 찾기 로직
        if (!headerIndices) {
          const colNameMatch = row.findIndex(c => String(c).replace(/\s/g, '') === '이름');
          const colRegMatch = row.findIndex(c => String(c).replace(/\s/g, '').includes('등록No') || String(c).replace(/\s/g, '').includes('등록번호'));
          
          if (colNameMatch !== -1 && colRegMatch !== -1) {
            const colIssueMatch = row.findIndex(c => String(c).replace(/\s/g, '').includes('발급일'));
            const colCohortMatch = row.findIndex(c => String(c).replace(/\s/g, '') === '기수');
            const colNoteMatch = row.findIndex(c => String(c).replace(/\s/g, '') === '비고');

            headerIndices = {
              name: colNameMatch,
              regNo: colRegMatch,
              issue: colIssueMatch,
              cohort: colCohortMatch,
              note: colNoteMatch
            };
            continue; // 헤더 발견 시 다음 행부터 데이터 파싱
          }
        } 
        else {
          // 데이터 행 파싱
          const nameStr = String(row[headerIndices.name] || '').trim();
          if (!nameStr || nameStr === '' || nameStr.includes('이름')) continue; // 빈 이름 무시

          uniqueNames.add(nameStr);

          parsedCompletions.push({
            courseName: courseName,
            name: nameStr,
            registration_no: String(row[headerIndices.regNo] || '').trim(),
            issued_date: headerIndices.issue !== -1 ? parseExcelDate(row[headerIndices.issue]) : null,
            cohort: headerIndices.cohort !== -1 ? String(row[headerIndices.cohort] || '').trim() : null,
            note: headerIndices.note !== -1 ? String(row[headerIndices.note] || '').trim() : null
          });
        }
      }
    });
  }

  console.log(`\n총 파싱된 수료 기록 수: ${parsedCompletions.length} 건`);
  console.log(`추출된 고유 회원(이름) 수: ${uniqueNames.size} 명`);

  if (parsedCompletions.length === 0) {
    console.log("데이터를 파싱하지 못했습니다. 종료합니다.");
    return;
  }

  // 3. Members 데이터베이스 일괄 삽입 (중복 무시)
  console.log("\n📦 Supabase에 회원 정보 등록 시작...");
  
  // RLS 정책 없이 insert 할 때 충돌을 방지하기 위해 배열을 조금씩 나누어 삽입합니다.
  const nameArray = Array.from(uniqueNames);
  const CHUNK_SIZE = 500;
  
  // 먼저 기존 회원 이름을 전부 조회하여 중복 등록 방지 (이름 기준)
  const { data: existingMembers, error: exisErr } = await supabase.from('members').select('id, name');
  const memberIdMap = {}; // name -> id
  if (existingMembers) {
    existingMembers.forEach(m => { memberIdMap[m.name] = m.id; });
  }

  const membersToInsert = [];
  nameArray.forEach(name => {
    if (!memberIdMap[name]) {
      membersToInsert.push({ name: name });
    }
  });

  if (membersToInsert.length > 0) {
    for (let i = 0; i < membersToInsert.length; i += CHUNK_SIZE) {
      const chunk = membersToInsert.slice(i, i + CHUNK_SIZE);
      const { data: inserted, error: insErr } = await supabase.from('members').insert(chunk).select('id, name');
      if (insErr) {
        console.error("회원 등록 에러:", insErr);
        return;
      }
      if (inserted) {
        inserted.forEach(m => { memberIdMap[m.name] = m.id; });
      }
    }
    console.log(`✅ 신규 회원 ${membersToInsert.length}명 등록 완료.`);
  } else {
    console.log(`✅ 모든 회원이 이미 등록되어 있습니다.`);
  }

  // 4. Completions 데이터베이스 일괄 삽입
  console.log("\n📦 Supabase에 수료 기록 등록 시작...");
  const completionsToInsert = parsedCompletions.map(pc => ({
    member_id: memberIdMap[pc.name],
    course_id: courseMap[pc.courseName],
    registration_no: pc.registration_no,
    issued_date: pc.issued_date,
    cohort: pc.cohort,
    note: pc.note
  })).filter(c => c.member_id && c.course_id); // 유효한 데이터만

  // 기존 수료 기록 지우고 새로 쓰거나, 중복을 감안해야 합니다. 여기선 모두 삭제 후 다시 넣는 방식이 깔끔합니다.
  console.log("기존 수료 기록 초기화 중...");
  await supabase.from('completions').delete().not('id', 'is', null);

  for (let i = 0; i < completionsToInsert.length; i += CHUNK_SIZE) {
    const chunk = completionsToInsert.slice(i, i + CHUNK_SIZE);
    const { error: compErr } = await supabase.from('completions').insert(chunk);
    if (compErr) {
      console.error("수료 기록 삽입 에러:", compErr);
      return;
    }
    process.stdout.write(`\r진행률: ${Math.min(i + CHUNK_SIZE, completionsToInsert.length)} / ${completionsToInsert.length}`);
  }

  console.log(`\n\n🎉 엑셀 데이터 매이그레이션이 모두 성공적으로 완료되었습니다!`);
}

main();

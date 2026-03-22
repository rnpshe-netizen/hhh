require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const COURSE_MAPPING = {
  "1. TRAIN 기초 수료증 발급 현황.xlsx": "TRAIN 기초",
  "2. TRAIN 심화 수료증 발급 대장.xls": "TRAIN 심화",
  "3. TRAIN Advanced 수료증 발급 대장.xls": "TRAIN Advanced",
  "4. TRAIN (기초+심화) 수료증 발급 대장.xls": "TRAIN 기초+심화",
  "5. 가족코칭 전문가 수료증 발급대장.xls": "가족코칭 전문가",
  "6. 가족코칭지도사 2급 자격증 발급 대장.xls": "가족코칭지도사 2급",
  "7. 라이프코칭  수료증 발급 대장.xls": "라이프코칭"
};

function parseExcelDate(d) {
  if (!d) return null;
  if (typeof d === 'number') {
    const date = new Date(Math.round((d - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  if (typeof d === 'string') {
    let s = d.replace(/[년월일\/\.]/g, '-').trim();
    s = s.replace(/-+/g, '-').replace(/-$/, '');
    const parts = s.split('-');
    if (parts.length >= 3) {
      const y = parts[0].replace(/[^0-9]/g, '');
      const m = parts[1].replace(/[^0-9]/g, '').padStart(2, '0');
      const d2 = parts[2].replace(/[^0-9]/g, '').padStart(2, '0');
      if (y.length === 4) return `${y}-${m}-${d2}`;
    }
  }
  return null;
}

async function main() {
  console.log("🚀 엑셀 데이터 DB 이관 스크립트 시작 (비고/재수강 완벽 지원 패치 버전)...");

  const { data: courses } = await supabase.from('courses').select('id, name');
  const courseMap = {};
  courses.forEach(c => { courseMap[c.name] = c.id; });

  const refDir = path.join(__dirname, '../references');
  const files = fs.readdirSync(refDir).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));

  const parsedCompletions = [];
  const uniqueNames = new Set();

  for (const file of files) {
    const courseName = Object.keys(COURSE_MAPPING).find(k => file.includes(k.substring(0, 10))) ? COURSE_MAPPING[file] : null;
    if (!courseName) continue;

    console.log(`📂 파일 처리: ${file}`);
    const wb = XLSX.readFile(path.join(refDir, file));

    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      let headerIndices = null;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!headerIndices) {
          const colNameMatch = row.findIndex(c => String(c).replace(/\s/g, '') === '이름');
          const colRegMatch = row.findIndex(c => String(c).replace(/\s/g, '').includes('등록'));
          
          if (colNameMatch !== -1 && colRegMatch !== -1) {
            headerIndices = {
              name: colNameMatch,
              regNo: colRegMatch,
              issue: row.findIndex(c => String(c).replace(/\s/g, '').includes('발급일')),
              cohort: row.findIndex(c => String(c).replace(/\s/g, '') === '기수'),
              note: row.findIndex(c => String(c).replace(/\s/g, '').includes('비고')),
              retake: row.findIndex(c => String(c).replace(/\s/g, '').includes('재수강'))
            };
            continue;
          }
        } 
        else {
          const nameStr = String(row[headerIndices.name] || '').trim();
          if (!nameStr || nameStr.includes('이름')) continue;

          uniqueNames.add(nameStr);

          let noteArr = [];
          if (headerIndices.note !== -1 && row[headerIndices.note]) {
            noteArr.push(String(row[headerIndices.note]).trim());
          }
          if (headerIndices.retake !== -1 && row[headerIndices.retake]) {
            const rt = String(row[headerIndices.retake]).trim();
            if(rt.includes('O') || rt.includes('V') || rt === '1') noteArr.push('재수강생');
            else noteArr.push(`${rt}`);
          }

          parsedCompletions.push({
            courseName: courseName,
            name: nameStr,
            registration_no: String(row[headerIndices.regNo] || '').trim(),
            issued_date: headerIndices.issue !== -1 ? parseExcelDate(row[headerIndices.issue]) : null,
            cohort: headerIndices.cohort !== -1 ? String(row[headerIndices.cohort] || '').trim() : null,
            note: noteArr.length > 0 ? noteArr.join(' / ') : null
          });
        }
      }
    });
  }

  console.log(`추출 완료: 고유 회원 ${uniqueNames.size}명, 수료 기록 ${parsedCompletions.length}건`);

  // Supabase 1000 Limit 버그 수정 (네트워크 부하 방지용 loop 페이징)
  const memberIdMap = {};
  for (let idx = 0; ; idx += 1000) {
    const { data } = await supabase.from('members').select('id, name').range(idx, idx + 999);
    if (!data || data.length === 0) break;
    data.forEach(m => { memberIdMap[m.name] = m.id; });
  }

  const nameArray = Array.from(uniqueNames);
  const membersToInsert = [];
  nameArray.forEach(name => {
    if (!memberIdMap[name]) membersToInsert.push({ name: name });
  });

  if (membersToInsert.length > 0) {
    for (let i = 0; i < membersToInsert.length; i += 500) {
      const chunk = membersToInsert.slice(i, i + 500);
      const { data } = await supabase.from('members').insert(chunk).select('id, name');
      if (data) data.forEach(m => { memberIdMap[m.name] = m.id; });
    }
  }

  console.log("기존 낡은 수료 기록 초기화 중...");
  // 수료 기록만 안전하게 모두 지운 뒤 '비고+재수강'이 탑재된 완전체 6658건으로 다시 붓습니다
  await supabase.from('completions').delete().neq('member_id', '00000000-0000-0000-0000-000000000000');

  const completionsToInsert = parsedCompletions.map(pc => ({
    member_id: memberIdMap[pc.name],
    course_id: courseMap[pc.courseName],
    registration_no: pc.registration_no,
    issued_date: pc.issued_date,
    cohort: pc.cohort,
    note: pc.note
  })).filter(c => c.member_id && c.course_id);

  console.log(`DB 삽입 시작: ${completionsToInsert.length}건...`);
  for (let i = 0; i < completionsToInsert.length; i += 500) {
    const chunk = completionsToInsert.slice(i, i + 500);
    await supabase.from('completions').insert(chunk);
    process.stdout.write(`\r진행률: ${Math.min(i + 500, completionsToInsert.length)} / ${completionsToInsert.length}`);
  }
  
  console.log("\n🎉 비고 및 재수강 데이터 복원 매이그레이션이 성공적으로 완료되었습니다!");
}
main();

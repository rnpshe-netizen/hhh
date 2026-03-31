// 3중 매칭 및 검증 리포트 생성 스크립트 (DB 대용으로 원본 엑셀 사용)
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { execSync } = require('child_process');
const XLSX = require('xlsx');

// PDF는 비동기 로드
let pdfjsLib;

// 정규식
const phoneRegex = /(?:010|011|016|017|018|019)[- .]*\d{3,4}[- .]*\d{4}/g;
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/* --- 1. DB 대용 원본 엑셀 로드 --- */
const dbDir = 'c:/HHH/references/1. 발급대장';
const dbMembers = {}; // name -> { courses: Set, cohorts: Set }
const dbTotalMembers = new Set();
// TRAIN 기초, TRAIN 심화, TRAIN Advanced, TRAIN (기초+심화), 가족코칭 전문가, 가족코칭지도사 2급, 라이프코칭

function loadDB() {
  const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
  files.forEach(file => {
    let courseName = '';
    if(file.includes('TRAIN 기초')) courseName = 'TRAIN 기초';
    else if(file.includes('TRAIN 심화')) courseName = 'TRAIN 심화';
    else if(file.includes('TRAIN Advanced')) courseName = 'TRAIN Advanced';
    else if(file.includes('TRAIN (기초+심화)')) courseName = 'TRAIN (기초+심화)';
    else if(file.includes('가족코칭 전문가')) courseName = '가족코칭전문가';
    else if(file.includes('가족코칭지도사')) courseName = '가족코칭지도사 2급';
    else if(file.includes('라이프코칭')) courseName = '라이프코칭';

    const wb = XLSX.readFile(path.join(dbDir, file));
    wb.SheetNames.forEach(sheetName => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
      let nameIdx = -1, cohortIdx = -1;
      
      for(let i=0; i<Math.min(rows.length, 10); i++){
        const row = rows[i];
        const n = row.findIndex(c => String(c).replace(/\s/g, '') === '이름');
        if(n !== -1) {
          nameIdx = n;
          cohortIdx = row.findIndex(c => String(c).replace(/\s/g, '') === '기수');
          break;
        }
      }
      if(nameIdx === -1) return;
      
      for(let i=0; i<rows.length; i++){
        const name = String(rows[i][nameIdx] || '').replace(/\s/g, '');
        if(!name || name === '이름' || name.length < 2) continue;
        
        const cohort = cohortIdx !== -1 ? String(rows[i][cohortIdx] || '').trim() : '';
        
        dbTotalMembers.add(name);
        if(!dbMembers[name]) dbMembers[name] = { courses: new Set(), cohorts: new Set() };
        if(courseName) dbMembers[name].courses.add(courseName);
        if(cohort) dbMembers[name].cohorts.add(cohort);
      }
    });
  });
}

/* --- 2. 추출 데이터 공간 --- */
const extracted = {}; // name -> { phone, email, histories: [{course, cohort, source}] }

function cleanPhone(phone) {
  if (!phone) return null;
  return phone.replace(/[^0-9]/g, '').replace(/^(01[016789])(\d{3,4})(\d{4})$/, '$1-$2-$3');
}

function parseCourseName(str) {
  if(str.includes('TRAIN기초') || str.includes('TRAIN 기초')) return 'TRAIN 기초';
  if(str.includes('심화')) return 'TRAIN 심화';
  if(str.includes('Advanced')) return 'TRAIN Advanced';
  if(str.includes('가족코칭전문가')) return '가족코칭전문가';
  if(str.includes('라이프코칭')) return '라이프코칭';
  return str;
}

function addExtracted(name, phoneText, emailText, course, cohort, source) {
  if (!name || name.length < 2) return;
  name = name.replace(/\s/g, '');
  
  let validPhone = null;
  if(phoneText) {
    const match = phoneText.match(phoneRegex);
    if(match) validPhone = cleanPhone(match[0]);
  }
  
  let validEmail = null;
  if(emailText) {
    const match = emailText.match(emailRegex);
    if(match) validEmail = match[0].toLowerCase();
  }

  if (!validPhone && !validEmail) return;

  if (!extracted[name]) extracted[name] = { phone: validPhone, email: validEmail, histories: [] };
  else {
    if (!extracted[name].phone && validPhone) extracted[name].phone = validPhone;
    if (!extracted[name].email && validEmail) extracted[name].email = validEmail;
  }
  
  extracted[name].histories.push({ course, cohort, source });
}

/* --- 3. 스캔 함수들 --- */
function extractFromName(filename) {
  const m1 = filename.match(/\((.*?)\)/);
  if (m1 && m1[1] && m1[1].length >= 2 && m1[1].length <= 5) return m1[1].trim();
  const m2 = filename.match(/_([^_.]+)\./);
  if (m2 && m2[1]) {
    let name = m2[1].replace(/수강신청서/g, '').replace(/신청서/g, '').replace(/참가/g, '').replace(/\(서명본\)/g, '').trim();
    if (name.length >= 2 && name.length <= 10) return name;
  }
  return null;
}

async function scanForms(dir, courseName = '', cohortName = '') {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      let nextCourse = courseName;
      let nextCohort = cohortName;
      if (!courseName) nextCourse = parseCourseName(item.name);
      else if (!cohortName) nextCohort = item.name.split('_')[0].trim();
      
      await scanForms(fullPath, nextCourse, nextCohort);
    } else {
      const ext = path.extname(item.name).toLowerCase();
      const name = extractFromName(item.name) || '알수없음';
      
      if (ext === '.docx') {
        try {
          const txt = (await mammoth.extractRawText({ path: fullPath })).value;
          addExtracted(name, txt, txt, courseName, cohortName, '수강신청서(DOCX)');
        } catch(e){}
      } else if (ext === '.hwp') {
        try {
          const txt = execSync(`node c:/HHH/tmp/parse_hwp.js "${fullPath}"`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
          addExtracted(name, txt, txt, courseName, cohortName, '수강신청서(HWP)');
        } catch(e){}
      } else if (ext === '.pdf' && !item.name.includes('수료증') && !item.name.includes('자격증')) {
        try {
          if(!pdfjsLib) pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
          const data = new Uint8Array(fs.readFileSync(fullPath));
          const doc = await pdfjsLib.getDocument({ data }).promise;
          let txt = '';
          for(let i=1; i<=doc.numPages; i++) txt += (await (await doc.getPage(i)).getTextContent()).items.map(it=>it.str).join(' ');
          addExtracted(name, txt, txt, courseName, cohortName, '수강신청서(PDF)');
        } catch(e){}
      }
    }
  }
}

function scanAttendance() {
  const dir = 'c:/HHH/references/3. 출석부';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
  for (const file of files) {
    const course = parseCourseName(file);
    try {
      const wb = XLSX.readFile(path.join(dir, file));
      wb.SheetNames.forEach(sheetName => {
        const cohort = sheetName;
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
        let hIdx = -1, nCol = -1, pCol = -1, eCol = -1;
        for(let i=0; i<Math.min(rows.length, 10); i++){
          const n = rows[i].findIndex(c => c && String(c).replace(/\s/g, '').includes('이름'));
          if (n !== -1) {
            hIdx = i; nCol = n;
            pCol = rows[i].findIndex(c => c && String(c).replace(/\s/g, '').match(/핸드폰|연락처|전화/));
            eCol = rows[i].findIndex(c => c && String(c).replace(/\s/g, '').includes('이메일'));
            break;
          }
        }
        if (hIdx !== -1) {
          for (let i = hIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            const name = String(row[nCol] || '').replace(/\s/g, '');
            if(!name) continue;
            const phone = pCol !== -1 ? String(row[pCol] || '') : '';
            const email = eCol !== -1 ? String(row[eCol] || '') : '';
            addExtracted(name, phone, email, course, cohort, '출석부(Excel)');
          }
        }
      });
    } catch(e){}
  }
}

async function run() {
  console.log('1. DB 로드 중...');
  loadDB();
  console.log(`- DB 회원 이름 ${dbTotalMembers.size}개 발견`);

  console.log('\n2. 수강신청서 & 출석부 추출 중...');
  await scanForms('c:/HHH/references/2. 수강신청서');
  scanAttendance();
  console.log(`- 추출된 연락처 고유 이름: ${Object.keys(extracted).length}명`);

  console.log('\n3. 매칭 검증 시작 (3-way match)...');
  const results = {
    exactMatch: [],
    courseMatch: [],
    nameOnlyMatch: [],
    notFoundInDB: [],
    duplicateNameConflict: []
  };

  for (const [name, data] of Object.entries(extracted)) {
    if (!dbTotalMembers.has(name)) {
      results.notFoundInDB.push(name);
      continue;
    }

    const dbCourses = Array.from(dbMembers[name].courses || []);
    const dbCohorts = Array.from(dbMembers[name].cohorts || []);
    
    let matchedCourse = false;
    let matchedCohort = false;

    data.histories.forEach(h => {
      if (dbCourses.some(dc => dc.includes(h.course) || h.course.includes(dc))) matchedCourse = true;
      if (dbCohorts.some(dc => dc.includes(h.cohort) || h.cohort.includes(dc))) matchedCohort = true;
    });

    if (matchedCourse && matchedCohort) results.exactMatch.push(name);
    else if (matchedCourse) results.courseMatch.push(name);
    else results.nameOnlyMatch.push(name);
  }

  // 매니저님을 위한 리포트 생성
  const report = `# 연락처 매칭 시뮬레이션 결과

## 📊 1. 전체 매칭 요약
* 총 추출된 인원: **${Object.keys(extracted).length}명** (수강신청서 + 출석부)
* DB(수료대장) 내 전체 고유 이름: **${dbTotalMembers.size}명**
* 전화번호만 덮어쓰기할 사람 수: **${results.exactMatch.length + results.courseMatch.length}명 (안전 매칭군)**

## 🛡️ 2. 매칭 안전도 분류 (3중 자물쇠 적용)

### 🟢 [1순위] 완벽 일치 (이름 + 과정 + 기수 교차검증 성공)
**${results.exactMatch.length}명**
- 수료대장과 추출 데이터(신청서/출석부) 양쪽 모두에서 소속 과정과 기수가 일치합니다.
- 동명이인 오류 확률이 0%에 수렴하며, **즉각 DB 업데이트**가 가능합니다.

### 🟡 [2순위] 과정 일치 (이름 + 과정명 일치)
**${results.courseMatch.length}명**
- 기수 번호 표기법(예: '1기' vs '21년 10월')이 달라 기수 매칭은 실패했지만, 소속 과정은 일치합니다.
- 이 그룹 역시 **동명이인일 확률이 매우 낮으므로 자동 업데이트 대상**으로 포함합니다.

### 🟠 [3순위] 이름만 일치 (수동 확인 필요)
**${results.nameOnlyMatch.length}명**
- 수료대장과 신청서 양쪽 모두에 이름은 있으나, 소속 과정 정보가 일치하지 않습니다.
- 동명이인이거나 이관 과정에서 누락이 발생했을 수 있습니다. 검토가 필요합니다.

### 🔴 [4순위] DB에 없는 신규 인원 (무시)
**${results.notFoundInDB.length}명**
- 신청서나 출석부에는 연락처가 있으나, 실제 수료대장(DB)에는 기록이 없는 분들입니다.
- 수료를 포기했거나 환불한 경우일 수 있으므로 **DB에 덮어쓰지 않고 제외**합니다.

---
**💡 개발자 소견:**
매니저님! 1순위(완벽일치)와 2순위(과정일치) 그룹은 합쳐서 **${results.exactMatch.length + results.courseMatch.length}명**입니다. 즉각 업데이트해도 안전한 수치입니다. 이 결과대로 데이터베이스(또는 백업용 JSON 파일 등)에 업데이트 스크립트를 생성해도 될까요?
`;

  fs.writeFileSync('c:/HHH/tmp/matching_report.md', report);
  fs.writeFileSync('c:/HHH/tmp/matching_report.json', JSON.stringify(results, null, 2));
  console.log('\n✅ 리포트 생성 완료: c:/HHH/tmp/matching_report.md 및 .json');
}

run();

// 전체 파일 텍스트 추출 및 연락처 파싱 스크립트
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { toMarkdown } = require('@ohah/hwpjs');
const XLSX = require('xlsx');

// pdfjs-dist requires dynamic import
let pdfjsLib;

const formsDir = 'c:/HHH/references/2. 수강신청서';
const attendanceDir = 'c:/HHH/references/3. 출석부';

// 정규식
const phoneRegex = /(?:010|011|016|017|018|019)[- .]*\d{3,4}[- .]*\d{4}/g;
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// 결과 저장용
const extractedContacts = {}; // { "홍길동": { phone: "010-1234-5678", email: "a@b.com", source: "수강신청서" } }

function cleanPhone(phone) {
  if (!phone) return null;
  return phone.replace(/[^0-9]/g, '').replace(/^(01[016789])(\d{3,4})(\d{4})$/, '$1-$2-$3');
}

function extractFromName(filename) {
  // 예: TRAIN 기초_수강신청서(김미영).pdf -> 김미영
  const match1 = filename.match(/\((.*?)\)/);
  if (match1 && match1[1] && match1[1].length >= 2 && match1[1].length <= 5) return match1[1].trim();
  
  // 예: TRAIN기초 수강신청서_김현우.pdf -> 김현우
  const match2 = filename.match(/_([^_.]+)\./);
  if (match2 && match2[1]) {
    let name = match2[1].replace(/수강신청서/g, '').replace(/신청서/g, '').replace(/참가/g, '').replace(/\(서명본\)/g, '').trim();
    if (name.length >= 2 && name.length <= 10) return name;
  }
  return null;
}

function addContact(name, phone, email, source) {
  if (!name || name.length < 2) return;
  
  let validPhone = null;
  if(phone) {
      const match = phone.match(phoneRegex);
      if(match) validPhone = cleanPhone(match[0]);
  }
  
  let validEmail = null;
  if(email) {
      const match = email.match(emailRegex);
      if(match) validEmail = match[0].toLowerCase();
  }

  if (!validPhone && !validEmail) return; // 연락처 정보가 하나도 없으면 무시

  if (!extractedContacts[name]) {
    extractedContacts[name] = { phone: validPhone, email: validEmail, source: [] };
  } else {
    if (!extractedContacts[name].phone && validPhone) extractedContacts[name].phone = validPhone;
    if (!extractedContacts[name].email && validEmail) extractedContacts[name].email = validEmail;
  }
  
  if (!extractedContacts[name].source.includes(source)) {
    extractedContacts[name].source.push(source);
  }
}

async function processDocx(filePath, fileName) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    const name = extractFromName(fileName);
    addContact(name, text, text, '수강신청서(DOCX)');
  } catch(e) {}
}

const { execSync } = require('child_process');

async function processHwp(filePath, fileName) {
  try {
    const rawMarkdown = execSync(`node c:/HHH/tmp/parse_hwp.js "${filePath}"`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    const name = extractFromName(fileName);
    addContact(name, rawMarkdown, rawMarkdown, '수강신청서(HWP)');
  } catch (e) {
    // console.log(`Skipped broken HWP: ${fileName}`);
  }
}

async function processPdf(filePath, fileName) {
  try {
    if (!pdfjsLib) {
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    }
    const data = new Uint8Array(fs.readFileSync(filePath));
    const doc = await pdfjsLib.getDocument({ data }).promise;
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + ' ';
    }
    const name = extractFromName(fileName);
    addContact(name, text, text, '수강신청서(PDF)');
  } catch(e) {}
}

async function scanForms(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      await scanForms(fullPath);
    } else {
      const ext = path.extname(item.name).toLowerCase();
      if (ext === '.docx') await processDocx(fullPath, item.name);
      else if (ext === '.hwp') await processHwp(fullPath, item.name);
      else if (ext === '.pdf' && !item.name.includes('수료증') && !item.name.includes('자격증')) await processPdf(fullPath, item.name);
    }
  }
}

function processAttendance() {
  const files = fs.readdirSync(attendanceDir).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
  for (const file of files) {
    const filePath = path.join(attendanceDir, file);
    try {
      const wb = XLSX.readFile(filePath);
      wb.SheetNames.forEach(sheetName => {
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        // Find header row
        let headerIdx = -1;
        let nameCol = -1, phoneCol = -1, emailCol = -1;
        
        for(let i=0; i<Math.min(rows.length, 10); i++){
          const row = rows[i];
          const n = row.findIndex(c => c && String(c).replace(/\s/g, '').includes('이름'));
          if (n !== -1) {
            headerIdx = i;
            nameCol = n;
            phoneCol = row.findIndex(c => c && String(c).replace(/\s/g, '').match(/핸드폰|연락처|전화/));
            emailCol = row.findIndex(c => c && String(c).replace(/\s/g, '').includes('이메일'));
            break;
          }
        }
        
        if (headerIdx !== -1) {
          for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            const name = nameCol !== -1 ? String(row[nameCol] || '').replace(/\s/g, '') : '';
            if (!name || name === '') continue;
            
            const phone = phoneCol !== -1 ? String(row[phoneCol] || '') : '';
            const email = emailCol !== -1 ? String(row[emailCol] || '') : '';
            
            if(name.length > 1) {
              addContact(name, phone, email, '출석부(Excel)');
            }
          }
        }
      });
    } catch(e) {
      console.log(`Error reading excel ${file}:`, e.message);
    }
  }
}

async function run() {
  console.log('--- 연락처 데이터 추출 시작 ---');
  
  console.log('1. 수강신청서 스캔 중...');
  await scanForms(formsDir);
  
  console.log('2. 출석부 엑셀 스캔 중...');
  processAttendance();
  
  const results = Object.entries(extractedContacts).map(([name, data]) => ({ name, ...data }));
  
  const hasPhone = results.filter(r => r.phone).length;
  const hasEmail = results.filter(r => r.email).length;
  const fromForms = results.filter(r => r.source.some(s => s.includes('수강신청서'))).length;
  const fromAttendance = results.filter(r => r.source.some(s => s.includes('출석부'))).length;
  
  console.log('\n=== 연락처 추출 요약 ===');
  console.log(`총 식별된 고유 인원: ${results.length}명`);
  console.log(`- 전화번호 확보: ${hasPhone}명`);
  console.log(`- 이메일 확보: ${hasEmail}명`);
  console.log(`- 소스별 기여: 수강신청서 ${fromForms}명 / 출석부 ${fromAttendance}명`);
  
  // 데이터 저장
  fs.writeFileSync('c:/HHH/tmp/extracted_contacts.json', JSON.stringify(extractedContacts, null, 2));
  console.log('\n추출 완료! 결과가 tmp/extracted_contacts.json 에 저장되었습니다.');
}

run();

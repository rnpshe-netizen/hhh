// 오염된 29명의 원본 파일에서 올바른 연락처 재추출
// 훈련원 접수용 연락처(010-8330-4399 / dreamhhh@naver.com)를 필터링
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { execSync } = require('child_process');

const BLOCKED_PHONES = ['010-8330-4399', '01083304399'];
const BLOCKED_EMAILS = ['dreamhhh@naver.com'];

const phoneRegex = /(?:010|011|016|017|018|019)[- .]*\d{3,4}[- .]*\d{4}/g;
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function cleanPhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  const m = digits.match(/^(01[016789])(\d{3,4})(\d{4})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function isBlocked(phone, email) {
  if (phone && BLOCKED_PHONES.includes(phone.replace(/[- ]/g, ''))) return 'phone';
  if (email && BLOCKED_EMAILS.includes(email.toLowerCase())) return 'email';
  return null;
}

function extractContacts(text) {
  const phones = (text.match(phoneRegex) || []).map(cleanPhone).filter(Boolean);
  const emails = (text.match(emailRegex) || []).map(e => e.toLowerCase());

  // 훈련원 연락처 제외
  const validPhones = phones.filter(p => !BLOCKED_PHONES.includes(p.replace(/-/g, '')));
  const validEmails = emails.filter(e => !BLOCKED_EMAILS.includes(e));

  return {
    phone: validPhones[0] || null,
    email: validEmails[0] || null,
    allPhones: phones,
    allEmails: emails,
    filteredPhones: validPhones,
    filteredEmails: validEmails
  };
}

async function readPdf(filePath) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

function readHwp(filePath) {
  return execSync(`node c:/HHH/tmp/parse_hwp.js "${filePath}"`, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
}

async function readDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

// 오염 회원 → 원본 파일 매핑 (첫 번째 파일만 사용)
const targets = {
  "144209": "c:/HHH/references/2. 수강신청서/3. TRAIN Advanced 수강신청서/25년 11월 15일 토요일 개강반/TRAIN Advanced  수강신청서_이종표_251105_144209.pdf",
  "고윤희": "c:/HHH/references/2. 수강신청서/1. TRAIN기초 수강신청서/1기_2020년 10월 8,15,22일 황현호진행/TRAIN 기초_수강신청서(고윤희).hwp",
  "마용희": "c:/HHH/references/2. 수강신청서/1. TRAIN기초 수강신청서/21년 6월 27,7월4,11,18일_인생디자인학교/TRAIN 코칭_수강신청서(마용희).hwp",
  "유정하": "c:/HHH/references/2. 수강신청서/1. TRAIN기초 수강신청서/22년 9월 1,15,22일/TRAIN 기초_수강신청서(유정하).hwp",
  "김진호": "c:/HHH/references/2. 수강신청서/1. TRAIN기초 수강신청서/23년 10월 5, 12, 19일/TRAIN 기초_수강신청서(김진호).hwp",
  "김면복": "c:/HHH/references/2. 수강신청서/1. TRAIN기초 수강신청서/23년 4월 8,15,29,5월 6일/TRAIN기초 수강신청서_김면복.pdf",
  "하양석": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/10기_21년 7월 3,17,24일/TRAIN 심화_수강신청서(하양석).hwp",
  "김재림": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/11기_21년 8월 13,20,27일/TRAIN 심화_수강신청서(김재림).hwp",
  "이유미": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/14기_21년 10월 30일, 11월 6일, 13일/TRAIN 심화 14기_수강신청서(이유미).hwp",
  "신승식": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/14기_21년 10월 30일, 11월 6일, 13일/TRAIN 심화_수강신청서(신승식).hwp",
  "유한나": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/1기_20년09월 10,17,24일/TRAIN 심화_수강신청서(유한나).hwp",
  "강정원": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/21기_22년 2월 18,25,3월 4일/TRAIN 심화_수강신청서_강정원.hwp",
  "김상홍": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/21기_22년 2월 18,25,3월 4일/TRAIN심화 수강신청서_김상홍.docx",
  "양은주": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/22기_22년 3월 16,23,30일/TRAIN 심화_수강신청서_양은주.hwp",
  "수기야마 에미": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/22기_22년 3월 16,23,30일/TRAIN 코칭_수강신청서(수기야마 에미).hwp",
  "김여종": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/28기_22년 5월 20,27,6월 3일/TRAIN 심화_수강신청서(김여종).hwp",
  "최정호": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/28기_22년 5월 20,27,6월 3일/TRAIN 심화_수강신청서(최정호).hwp",
  "나선채": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/31기_22년 9월 7,14,21일/TRAIN 심화_수강신청서_나선채.hwp",
  "김현정": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/34기_22년 11월 12,19,26,12월3일/TRAIN 심화 수강신청서_김현정.hwp",
  "강진영": "c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/7기_21년 4월 1,8,15일/TRAIN 심화_수강신청서(강진영).hwp",
  "이정숙": "c:/HHH/references/2. 수강신청서/3. TRAIN Advanced 수강신청서/10기_2024년 1월 18, 25, 2월 1일 목요반/TRAIN Advanced  수강신청서(이정숙).pdf",
  "김선희6951": "c:/HHH/references/2. 수강신청서/3. TRAIN Advanced 수강신청서/13기_2024년 2월 22, 29, 3월 7일/TRAIN Advanced 수강신청서_김선희6951.docx",
  "김희진": "c:/HHH/references/2. 수강신청서/3. TRAIN Advanced 수강신청서/1기_23년 7월 22,29,8월5일/TRAIN 심화과정 신청서_김희진.docx",
  "조은경": "c:/HHH/references/2. 수강신청서/3. TRAIN Advanced 수강신청서/25년 10월 23, 30, 11월 6일 목요일/TRAIN Advanced  수강신청서_조은경.hwp",
  "정성은": "c:/HHH/references/2. 수강신청서/3. TRAIN Advanced 수강신청서/25년 11월 15일 토요일 개강반/TRAIN Advanced 수강신청서_정성은.pdf",
  "송성원": "c:/HHH/references/2. 수강신청서/3. TRAIN Advanced 수강신청서/26년 2월 13, 20, 30일 금요반/251229 TRAIN Advanced 수강신청서_송성원.pdf",
  "최여림": "c:/HHH/references/2. 수강신청서/5. 가족코칭전문가 수강신청서/69기_25년 8월 7, 14, 21일 목요반/가족코칭전문가 수강신청서_최여림.pdf",
  "권영선": "c:/HHH/references/2. 수강신청서/5. 가족코칭전문가 수강신청서/70기_26년 4월 3,10, 17일 금요반/가족코칭전문가_수강신청서_권영선.pdf",
  "이석구": "c:/HHH/references/2. 수강신청서/6. 라이프 코칭 수강 신청서/2기_2025년 10월 10일~10월 24일/라이프코칭 수강신청서_이석구.pdf",
};

// 기존 오염 데이터 (비교용)
const oldContacts = require('c:/HHH/tmp/extracted_contacts.json');

async function run() {
  console.log('=== 오염 회원 29명 연락처 재추출 ===\n');

  const results = [];

  for (const [name, filePath] of Object.entries(targets)) {
    const ext = path.extname(filePath).toLowerCase();
    let text = '';

    try {
      if (ext === '.pdf') text = await readPdf(filePath);
      else if (ext === '.hwp') text = readHwp(filePath);
      else if (ext === '.docx') text = await readDocx(filePath);
    } catch (e) {
      console.log(`[ERROR] ${name}: 파일 읽기 실패 - ${e.message}`);
      results.push({ name, status: 'error', error: e.message });
      continue;
    }

    const contacts = extractContacts(text);
    const old = oldContacts[name] || {};

    const result = {
      name,
      old: { phone: old.phone || null, email: old.email || null },
      new: { phone: contacts.phone, email: contacts.email },
      allFound: { phones: contacts.allPhones, emails: contacts.allEmails },
      filtered: { phones: contacts.filteredPhones, emails: contacts.filteredEmails },
      status: 'ok',
      file: path.basename(filePath)
    };

    // 변화 요약
    const changes = [];
    if (old.phone !== contacts.phone) changes.push(`phone: ${old.phone} → ${contacts.phone}`);
    if (old.email !== contacts.email) changes.push(`email: ${old.email} → ${contacts.email}`);
    result.changes = changes;

    results.push(result);

    const icon = changes.length > 0 ? '🔧' : '✅';
    console.log(`${icon} ${name}: ${changes.length > 0 ? changes.join(' | ') : '변화없음'}`);
  }

  // 요약
  console.log('\n=== 재추출 요약 ===');
  const fixed = results.filter(r => r.changes && r.changes.length > 0);
  const noChange = results.filter(r => r.changes && r.changes.length === 0);
  const errors = results.filter(r => r.status === 'error');

  console.log(`수정됨: ${fixed.length}명`);
  console.log(`변화없음: ${noChange.length}명`);
  console.log(`에러: ${errors.length}명`);

  // 결과 저장
  fs.writeFileSync('c:/HHH/tmp/reextracted_contacts.json', JSON.stringify(results, null, 2));
  console.log('\n결과 저장: c:/HHH/tmp/reextracted_contacts.json');
}

run().catch(console.error);

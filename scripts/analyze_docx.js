// 수강신청서 DOCX 샘플 분석 스크립트
// 목적: DOCX 파일 내부에서 이름, 전화번호, 이메일이 어디에 있는지 파악

const mammoth = require('mammoth');
const path = require('path');

const samples = [
  'c:/HHH/references/2. 수강신청서/1. TRAIN기초 수강신청서/25년 1월 4,11,18일 토요반/TRAIN기초 수강신청서_김수인.docx',
  'c:/HHH/references/2. 수강신청서/3. TRAIN Advanced 수강신청서/TRAIN Advanced 수강신청서_김향기.docx',
  'c:/HHH/references/2. 수강신청서/7. 라이프 코칭 수강 신청서/4기_2026년 2월 14, 21, 28일/라이프코칭 수강신청서_김명식.docx',
  'c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/40기_23년 3월 17, 24, 31일/Train_심화_신청서_차예원.docx',
];

async function analyzeSamples() {
  for (const filePath of samples) {
    console.log('='.repeat(80));
    console.log(`파일: ${path.basename(filePath)}`);
    console.log('='.repeat(80));
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;
      // 텍스트 전체를 줄바꿈 기준으로 보여줌
      const lines = text.split('\n').filter(l => l.trim());
      lines.forEach((line, i) => {
        console.log(`[${i+1}] ${line.trim()}`);
      });
    } catch(e) {
      console.log(`오류: ${e.message}`);
    }
    console.log('\n');
  }
}

analyzeSamples();

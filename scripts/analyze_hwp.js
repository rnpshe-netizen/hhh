// HWP 파일 텍스트 추출 테스트
const HWPDocument = require('hwp.js');
const fs = require('fs');
const path = require('path');

const samples = [
  'c:/HHH/references/2. 수강신청서/5. 가족코칭전문가 수강신청서/가족코치 전문가_수강신청서(홍길동).hwp',
  'c:/HHH/references/2. 수강신청서/2. TRAIN심화 수강신청서/40기_23년 3월 17, 24, 31일/TRAIN 심화_수강신청서(강진유).hwp',
  'c:/HHH/references/2. 수강신청서/1. TRAIN기초 수강신청서/1기_2020년 10월 8,15,22일 황현호진행/TRAIN 기초_수강신청서(고윤희).hwp',
];

async function analyzeHwp() {
  for (const filePath of samples) {
    console.log('='.repeat(80));
    console.log(`파일: ${path.basename(filePath)}`);
    console.log('='.repeat(80));
    try {
      const buffer = fs.readFileSync(filePath);
      const hwpDoc = new HWPDocument(buffer);
      // hwp.js 에서 텍스트 추출 시도
      if (hwpDoc && hwpDoc.toText) {
        const text = hwpDoc.toText();
        const lines = text.split('\n').filter(l => l.trim());
        lines.forEach((line, i) => {
          console.log(`[${i+1}] ${line.trim()}`);
        });
      } else {
        // 다른 방법 시도
        console.log('API 구조:', Object.keys(hwpDoc));
        console.log('toString:', String(hwpDoc).substring(0, 500));
      }
    } catch(e) {
      console.log(`오류: ${e.message}`);
    }
    console.log('\n');
  }
}

analyzeHwp();

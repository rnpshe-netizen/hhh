// PDF 텍스트 추출 테스트 (pdfjs-dist 사용)
const fs = require('fs');
const path = require('path');

const pdfSamples = [
  'c:/HHH/references/2. 수강신청서/1. TRAIN기초 수강신청서/21년 6월 27,7월4,11,18일_인생디자인학교/TRAIN 기초_수강신청서(정인균).pdf',
  'c:/HHH/references/2. 수강신청서/1. TRAIN기초 수강신청서/22년 4월 2,9,16일/TRAIN 기초_수강신청서(김미영).pdf',
  'c:/HHH/references/2. 수강신청서/5. 가족코칭전문가 수강신청서/70기_26년 4월 3,10, 17일 금요반/가족코칭전문가_수강신청서_권영선.pdf',
];

async function testPdf() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  for (const filePath of pdfSamples) {
    console.log('='.repeat(80));
    console.log(`파일: ${path.basename(filePath)}`);
    console.log('='.repeat(80));
    try {
      const data = new Uint8Array(fs.readFileSync(filePath));
      const doc = await pdfjsLib.getDocument({ data }).promise;
      let fullText = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map(item => item.str).join(' ');
        fullText += text + '\n';
      }
      const lines = fullText.split('\n').filter(l => l.trim());
      if (lines.length === 0 || fullText.trim().length < 10) {
        console.log('⚠️ 텍스트 없음 → 스캔 이미지 PDF (OCR 필요)');
      } else {
        lines.slice(0, 25).forEach((line, i) => {
          console.log(`[${i+1}] ${line.trim()}`);
        });
      }
    } catch(e) {
      console.log(`오류: ${e.message}`);
    }
    console.log('\n');
  }
}

testPdf();

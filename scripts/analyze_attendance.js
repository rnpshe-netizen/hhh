// 출석부 엑셀 내부 구조 분석 (시트명, 컬럼명 파악)
const XLSX = require('xlsx');
const path = require('path');

const files = [
  'c:/HHH/references/3. 출석부/1. 출석부_TRAIN 기초.xlsx',
  'c:/HHH/references/3. 출석부/2. 출석부_TRAIN 심화.xlsx',
  'c:/HHH/references/3. 출석부/6. 출석부_라이프코칭_역량 20시간.xlsx',
];

files.forEach(filePath => {
  console.log('='.repeat(80));
  console.log(`파일: ${path.basename(filePath)}`);
  console.log('='.repeat(80));
  const wb = XLSX.readFile(filePath);
  console.log(`시트 수: ${wb.SheetNames.length}개`);
  console.log(`시트 목록: ${wb.SheetNames.slice(0, 10).join(', ')}${wb.SheetNames.length > 10 ? '...' : ''}`);
  
  // 첫 시트의 헤더 행 확인
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
  console.log(`\n[첫 시트: "${wb.SheetNames[0]}"] 상위 5행:`);
  rows.slice(0, 5).forEach((row, i) => {
    console.log(`  행${i+1}: ${row.slice(0, 10).join(' | ')}`);
  });
  console.log('\n');
});

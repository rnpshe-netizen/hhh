const XLSX = require('xlsx');
const path = require('path');

function getNames(filePath) {
  const wb = XLSX.readFile(filePath);
  const names = new Set();
  
  wb.SheetNames.forEach(sheetName => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
    let nameCol = -1;
    
    for (let row of rows) {
      if (nameCol === -1) {
        nameCol = row.findIndex(c => String(c).replace(/\s/g, '') === '이름');
      } else {
        if (nameCol >= 0 && row.length > nameCol) {
           const name = String(row[nameCol] || '').trim();
           if (name && !name.includes('이름')) {
             names.add(name);
           }
        }
      }
    }
  });
  return names;
}

try {
  const refDir = path.join(__dirname, '../references');
  const f1 = getNames(path.join(refDir, '1. TRAIN 기초 수료증 발급 현황.xlsx'));
  const f2 = getNames(path.join(refDir, '2. TRAIN 심화 수료증 발급 대장.xls'));
  const f4 = getNames(path.join(refDir, '4. TRAIN (기초+심화) 수료증 발급 대장.xls'));

  console.log(`[1. 기초 파일] 고유 인원 총: ${f1.size}명`);
  console.log(`[2. 심화 파일] 고유 인원 총: ${f2.size}명`);
  console.log(`[4. 기초+심화 파일] 고유 인원 총: ${f4.size}명\n`);

  let f1InF4 = 0;
  f1.forEach(name => { if (f4.has(name)) f1InF4++; });

  let f2InF4 = 0;
  f2.forEach(name => { if (f4.has(name)) f2InF4++; });

  console.log(`[1. 기초] 수료자 중 -> [4. 기초+심화]에도 이름이 있는 사람: ${f1InF4}명 (${Math.round((f1InF4/f1.size)*100)}%)`);
  console.log(`[2. 심화] 수료자 중 -> [4. 기초+심화]에도 이름이 있는 사람: ${f2InF4}명 (${Math.round((f2InF4/f2.size)*100)}%)`);

  const f1Only = f1.size - f1InF4;
  const f2Only = f2.size - f2InF4;

  console.log(`\n결론:`);
  console.log(`만약 [1. 기초 파일]을 통째로 지우면, 4번에 없는 [순수 기초 수료자] ${f1Only}명의 데이터가 공중 증발합니다.`);
  console.log(`만약 [2. 심화 파일]을 통째로 지우면, 4번에 없는 [순수 심화 수료자] ${f2Only}명의 데이터가 공중 증발합니다.`);
} catch (e) {
  console.error("분석 중 에러:", e);
}

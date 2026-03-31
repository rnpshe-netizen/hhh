const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
  "1. TRAIN 기초 수료증 발급 현황.xlsx",
  "2. TRAIN 심화 수료증 발급 대장.xls",
  "3. TRAIN Advanced 수료증 발급 대장.xls",
  "4. TRAIN (기초+심화) 수료증 발급 대장.xls",
  "5. 가족코칭 전문가 수료증 발급대장.xls",
  "6. 가족코칭지도사 2급 자격증 발급 대장.xls",
  "7. 라이프코칭  수료증 발급 대장.xls"
];

const refDir = 'c:/HHH/references';

async function run() {
  const memberData = {}; // name -> { files: [], phoneCount: 0, emailCount: 0 }
  let totalRecords = 0;

  files.forEach(file => {
    const filePath = path.join(refDir, file);
    if (!fs.existsSync(filePath)) return;
    
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    let nameIdx = -1;
    let phoneIdx = -1;
    
    // 헤더 행 찾기
    for(let i=0; i<Math.min(rows.length, 10); i++){
      const row = rows[i];
      const n = row.findIndex(c => String(c).replace(/\s/g, '') === '이름');
      if(n !== -1) {
        nameIdx = n;
        phoneIdx = row.findIndex(c => String(c).replace(/\s/g, '').includes('연락처') || String(c).replace(/\s/g, '').includes('전화'));
        break;
      }
    }
    
    if(nameIdx === -1) return;
    
    for(let i=1; i<rows.length; i++){
      const row = rows[i];
      const name = String(row[nameIdx] || '').trim();
      if(!name || name === '이름') continue;
      
      totalRecords++;
      if(!memberData[name]) {
        memberData[name] = { files: new Set(), phones: new Set() };
      }
      memberData[name].files.add(file);
      if(phoneIdx !== -1 && row[phoneIdx]) {
        memberData[name].phones.add(String(row[phoneIdx]).trim());
      }
    }
  });

  const totalMembers = Object.keys(memberData).length;
  const multiFileMembers = Object.values(memberData).filter(m => m.files.size > 1).length;
  const noPhoneMembers = Object.values(memberData).filter(m => m.phones.size === 0).length;
  
  // 동명이인 의심 사례 (한 이름에 여러 기수 혹은 여러 파일에 분산)
  const suspicious = Object.entries(memberData)
    .map(([name, data]) => ({ name, fileCount: data.files.size }))
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, 10);

  console.log('--- 엑셀 원본 데이터 정밀 분석 결과 ---');
  console.log(`총 수료 레코드: ${totalRecords}건`);
  console.log(`병합된 고유 회원: ${totalMembers}명`);
  console.log(`연락처(전화번호)가 아예 없는 회원: ${noPhoneMembers}명 (${((noPhoneMembers/totalMembers)*100).toFixed(1)}%)`);
  console.log(`2개 이상의 서로 다른 과정에 참여한 회원: ${multiFileMembers}명`);
  console.log('\n--- 관리가 시급한 동명이인 의심 이름 (여러 파일 중복 등장) ---');
  suspicious.forEach((s, i) => {
    console.log(`${i+1}. [${s.name}]님 (${s.fileCount}개 종류의 파일에서 발견됨)`);
  });
}

run();

// 전체 수강신청서 파일 확장자별 통계 산출
const fs = require('fs');
const path = require('path');

const baseDir = 'c:/HHH/references/2. 수강신청서';
const stats = { hwp: 0, docx: 0, pdf: 0, jpg: 0, png: 0, xls: 0, xlsx: 0, other: 0 };
let totalFiles = 0;
let totalFolders = 0;

function scan(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      totalFolders++;
      scan(fullPath);
    } else {
      totalFiles++;
      const ext = path.extname(item.name).toLowerCase().replace('.', '');
      if (stats.hasOwnProperty(ext)) {
        stats[ext]++;
      } else {
        stats.other++;
        console.log(`기타형식: ${item.name}`);
      }
    }
  }
}

scan(baseDir);

console.log('\n=== 수강신청서 전체 통계 ===');
console.log(`총 폴더 수: ${totalFolders}개`);
console.log(`총 파일 수: ${totalFiles}개`);
console.log('\n--- 확장자별 분포 ---');
for (const [ext, count] of Object.entries(stats)) {
  if (count > 0) {
    console.log(`  .${ext}: ${count}개 (${((count/totalFiles)*100).toFixed(1)}%)`);
  }
}

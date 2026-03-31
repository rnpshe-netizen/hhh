const { toMarkdown } = require('@ohah/hwpjs');
const fs = require('fs');
const filePath = process.argv[2];

try {
  const buffer = fs.readFileSync(filePath);
  const { markdown } = toMarkdown(buffer, { image: 'none' });
  console.log(markdown);
} catch (e) {
  process.exit(1);
}

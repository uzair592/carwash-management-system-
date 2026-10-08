const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let res = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) res = res.concat(getFiles(full));
    else if (full.endsWith('.jsx') || full.endsWith('.js')) res.push(full);
  }
  return res;
}

const clientFiles = getFiles('client/src');
const serverFiles = getFiles('src');
const files = [...clientFiles, ...serverFiles];
console.log(`Checking ${files.length} total files for broken imports...`);

let issues = 0;
const importRegex = /import\s+(?:(?:[\w*\s{},]+)\s+from\s+)?['"]([^'"]+)['"]/g;
const requireRegex = /require\(['"]([^'"]+)['"]\)/g;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let m;
  const regexes = [importRegex, requireRegex];
  for (const regex of regexes) {
    while ((m = regex.exec(content)) !== null) {
      const importPath = m[1];
      if (importPath.startsWith('.')) {
        const dir = path.dirname(file);
        const resolved = path.resolve(dir, importPath);
        const candidates = [
          resolved,
          resolved + '.js',
          resolved + '.jsx',
          resolved + '.json',
          path.join(resolved, 'index.js'),
          path.join(resolved, 'index.jsx'),
        ];
        const exists = candidates.some(c => fs.existsSync(c));
        if (!exists) {
          console.error(`[BROKEN IMPORT/REQUIRE] in ${path.relative('.', file)}: cannot find '${importPath}'`);
          issues++;
        }
      }
    }
  }
}

if (issues === 0) {
  console.log('✔ All relative imports resolved successfully!');
} else {
  console.log(`Found ${issues} broken import(s).`);
}

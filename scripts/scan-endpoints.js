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

const files = getFiles('client/src');
const regex = /axios\.(get|post|put|patch|delete)\((?:`([^`]+)`|'([^']+)'|"([^"]+)")/g;
const calls = new Set();
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = regex.exec(content)) !== null) {
    const method = m[1].toUpperCase();
    const raw = (m[2] || m[3] || m[4]);
    const endpoint = raw.split('?')[0].replace(/\$\{[^}]+\}/g, ':id');
    calls.add(`${method} ${endpoint} (in ${path.relative('client/src', file)})`);
  }
}

console.log('=== FRONTEND CALLS ===');
Array.from(calls).sort().forEach(c => console.log(c));

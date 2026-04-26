/**
 * useState(null) infers literal null → branches become `never` after null checks.
 * useState([]) infers never[].
 * Relax with explicit any element types.
 */
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..', 'src');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(ent.name) && !ent.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

let files = 0;
let edits = 0;

for (const fp of walk(root)) {
  let t = fs.readFileSync(fp, 'utf8');
  const orig = t;
  // Avoid touching `useState(null as Foo)`
  t = t.replace(/useState\(null\)(?!\s*as)/g, () => {
    edits += 1;
    return 'useState<any>(null)';
  });
  t = t.replace(/useState\(\[\]\)/g, () => {
    edits += 1;
    return 'useState<any[]>([])';
  });
  if (t !== orig) {
    fs.writeFileSync(fp, t, 'utf8');
    files += 1;
  }
}

console.log(`Edited ${files} files (${edits} replacements).`);

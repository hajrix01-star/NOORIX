/**
 * جرد ملفات TypeScript/TSX الكبيرة — جذر المستودع: node scripts/audit-large-files.mjs
 * الخيارات: --min=400 (افتراضي)  --backend-only  --frontend-only
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const args = process.argv.slice(2);
let min = 400;
const backendOnly = args.includes('--backend-only');
const frontendOnly = args.includes('--frontend-only');
const minArg = args.find((a) => a.startsWith('--min='));
if (minArg) min = parseInt(minArg.split('=')[1], 10) || min;

function walk(dir, acc, ignore) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'build' || name === '.git') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc, ignore);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      const rel = path.relative(root, p);
      if (ignore.some((re) => re.test(rel.replace(/\\/g, '/')))) continue;
      const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).length;
      if (lines >= min) acc.push({ lines, rel: rel.replace(/\\/g, '/') });
    }
  }
}

const ignore = [/\.test\.ts$/, /\.spec\.ts$/, /\.spec\.tsx$/];
const acc = [];
if (!frontendOnly) walk(path.join(root, 'backend', 'src'), acc, ignore);
if (!backendOnly) walk(path.join(root, 'src'), acc, ignore);

acc.sort((a, b) => b.lines - a.lines);
console.log(`— ملفات ≥ ${min} سطراً (باستثناء *.spec / *.test) —\n`);
for (const { lines, rel } of acc.slice(0, 80)) {
  console.log(String(lines).padStart(5), ' ', rel);
}
if (acc.length > 80) console.log(`\n… و${acc.length - 80} ملفاً إضافياً (قصّ العرض عند 80).`);
console.log(`\nالإجمالي: ${acc.length} ملفاً ≥ ${min} سطراً.`);

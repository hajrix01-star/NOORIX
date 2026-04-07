/**
 * فحص سريع لمخالفات UI — شغّل: npm run ui:audit
 * فحص صارم (فشل exit 1): npm run ui:audit:strict
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC = join(process.cwd(), 'src');
const exts = new Set(['.jsx', '.tsx']);
const strict = process.argv.includes('--strict');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (exts.has(extname(name))) out.push(p);
  }
  return out;
}

function rel(p) {
  return p.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '');
}

const files = walk(SRC);
let styleInline = 0;
const styleFiles = [];
let buttonTotal = 0;
let buttonWithSize = 0;
let rawButtonHits = 0;
const rawButtonFiles = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const r = rel(file);

  const styleMatches = text.match(/style=\{\{/g);
  if (styleMatches) {
    styleInline += styleMatches.length;
    if (!r.includes('ui/Button.jsx') && !r.includes('ui\\Button.jsx')) {
      styleFiles.push({ file: r, count: styleMatches.length });
    }
  }

  const btnRe = /<Button\b/g;
  let m;
  while ((m = btnRe.exec(text)) !== null) {
    buttonTotal++;
    const slice = text.slice(m.index, Math.min(text.length, m.index + 500));
    if (/\bsize\s*=\s*["'](?:sm|md|lg)["']/.test(slice)) buttonWithSize++;
  }

  const normPath = r.replace(/\\/g, '/');
  if (!normPath.endsWith('ui/Button.jsx')) {
    const rawBtns = text.match(/<button\b/g);
    if (rawBtns && rawBtns.length) {
      rawButtonHits += rawBtns.length;
      rawButtonFiles.push({ file: r, count: rawBtns.length });
    }
  }
}

const toolbarButtonFiles = files.filter((f) => {
  const t = readFileSync(f, 'utf8');
  return (t.includes('nx-toolbar') || t.includes('nx-page-header')) && t.includes('<Button');
});

console.log('=== Noorix UI Audit ===\n');
console.log(`ملفات JSX/TSX: ${files.length}`);
console.log(`وسوم style={{ (إجمالي تقريبي): ${styleInline}`);
console.log(`أزرار <Button (عدّ): ${buttonTotal} | مع size= صريح: ${buttonWithSize} | بدون size: ~${buttonTotal - buttonWithSize}`);

console.log(`\nوسوم <button> خام (يجب أن يبقى المصدر الوحيد ui/Button.jsx): ${rawButtonHits}`);
if (rawButtonFiles.length) {
  rawButtonFiles
    .sort((a, b) => b.count - a.count)
    .forEach((x) => console.log(`  ${x.count}\t${x.file}`));
}

console.log('\nأعلى 15 ملفاً بـ style={{ (راجع قاعدة ui-components — تخطيط/ألوان):');
styleFiles
  .sort((a, b) => b.count - a.count)
  .slice(0, 15)
  .forEach((x) => console.log(`  ${x.count}\t${x.file}`));

console.log('\nملفات تحتوي nx-toolbar أو nx-page-header + Button — راجع size="sm" للأدوات حسب ui-responsive-standards:');
toolbarButtonFiles
  .map((f) => rel(f))
  .sort()
  .forEach((x) => console.log(`  ${x}`));

console.log('\n--- فحص يدوي: 375px · 768px · 1280px — مسار حرج واحد ---\n');

if (strict && rawButtonHits > 0) {
  console.error('ui-audit:strict — وُجد <button> خارج ui/Button.jsx');
  process.exit(1);
}

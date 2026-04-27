/**
 * مسح كل ملفات ‎*.service.ts تحت ‎backend/src — ميثاق هدف ≤450 سطر؛ تحذير >450؛ فشل >900.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const srcRoot = path.join(repoRoot, 'backend', 'src');
const TARGET = 450;
const HARD = 900;

/** @param {string} dir @param {string[]} acc */
function walkServiceFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkServiceFiles(p, acc);
    else if (ent.isFile() && ent.name.endsWith('.service.ts')) acc.push(p);
  }
  return acc;
}

const files = walkServiceFiles(srcRoot)
  .map((p) => {
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).length;
    const rel = path.relative(repoRoot, p).replace(/\\/g, '/');
    return { rel, lines };
  })
  .sort((a, b) => b.lines - a.lines);

let fail = false;
for (const { rel, lines } of files) {
  const tag = lines > HARD ? 'FAIL' : lines > TARGET ? 'WARN' : 'ok';
  if (lines > HARD) fail = true;
  const line = `${String(lines).padStart(4)}  ${tag.padEnd(4)}  ${rel}`;
  if (lines > TARGET && lines <= HARD) console.warn(line);
  else console.log(line);
}
console.log(`— الهدف ${TARGET} سطراً؛ تحذير عند > ${TARGET}؛ فشل عند > ${HARD}`);
process.exit(fail ? 1 : 0);

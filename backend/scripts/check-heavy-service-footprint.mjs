/**
 * تقرير أحجام خدمات financial-core — ميثاق هدف ≤450 سطر لكل ملف خدمة (تحذير فقط).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fcdir = path.join(__dirname, '../src/financial-core');
const TARGET = 450;
const HARD = 900;

const files = fs
  .readdirSync(fcdir)
  .filter((f) => f.endsWith('.service.ts'))
  .map((f) => {
    const p = path.join(fcdir, f);
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).length;
    return { f, lines };
  })
  .sort((a, b) => b.lines - a.lines);

let fail = false;
for (const { f, lines } of files) {
  const tag = lines > HARD ? 'FAIL' : lines > TARGET ? 'WARN' : 'ok';
  if (lines > HARD) fail = true;
  console.log(`${String(lines).padStart(4)}  ${tag.padEnd(4)}  ${f}`);
}
console.log(`— الهدف ${TARGET} سطراً؛ فشل صريح عند > ${HARD}`);
process.exit(fail ? 1 : 0);

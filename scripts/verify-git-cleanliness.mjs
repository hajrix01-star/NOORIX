/**
 * يفشل إن وُجدت مسارات uploads أو artifacts حساسة تحت تتبّع Git.
 * تشغيل من جذر المستودع: node scripts/verify-git-cleanliness.mjs
 */
import { execSync } from 'child_process';

/** فشل صريح: مجلدات رفع الملفات الحساسة تحت Git (معيار Q1 في مراجعة 360) */
const failPatterns = [/^uploads\//, /^backend\/uploads\//];

/** تحذير فقط — أزلها من التتبع تدريجياً */
const warnPatterns = [/\.xlsx$/i, /build-out\.txt$/i, /^cursorrules.*\.txt$/i];

const strict = process.argv.includes('--strict');

let tracked;
try {
  tracked = execSync('git ls-files', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch {
  console.warn('[verify-git-cleanliness] git ls-files failed — skip (not a git checkout?)');
  process.exit(0);
}

const norm = (line) => line.replace(/\\/g, '/');
const fails = [];
const warns = [];
for (const line of tracked.split(/\r?\n/)) {
  if (!line.trim()) continue;
  const n = norm(line);
  if (failPatterns.some((re) => re.test(n))) fails.push(line);
  else if (warnPatterns.some((re) => re.test(n))) warns.push(line);
}

if (warns.length) {
  console.warn('[verify-git-cleanliness] تحذير — مسارات يُفضّل عدم تتبّعها:\n', warns.join('\n'));
}
if (strict && warns.length) {
  console.error('[verify-git-cleanliness] --strict: فشل بسبب التحذيرات أعلاه');
  process.exit(1);
}
if (fails.length) {
  console.error('[verify-git-cleanliness] فشل — uploads تحت Git:\n', fails.join('\n'));
  process.exit(1);
}
console.log('[verify-git-cleanliness] ok — لا uploads تحت التتبع.');
process.exit(0);

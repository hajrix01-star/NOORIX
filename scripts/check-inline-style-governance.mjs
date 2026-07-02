import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'inline-style-governance-baseline.json'), 'utf8'));

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(name)) continue;
      walk(full, out);
    } else if (/\.(tsx|ts)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const counts = new Map();
const pattern = /style=\{\{/g;

for (const file of walk(path.join(root, 'src'))) {
  const text = fs.readFileSync(file, 'utf8');
  const matches = Array.from(text.matchAll(pattern)).length;
  if (!matches) continue;
  const rel = path.relative(root, file).replace(/\\/g, '/');
  counts.set(rel, matches);
}

const entries = Array.from(counts.entries());
const total = entries.reduce((sum, [, count]) => sum + count, 0);
const uiEntries = entries.filter(([file]) => file.startsWith('src/ui/'));
const outsideUiEntries = entries.filter(([file]) => !file.startsWith('src/ui/'));

const actual = {
  total,
  files: entries.length,
  ui: uiEntries.reduce((sum, [, count]) => sum + count, 0),
  uiFiles: uiEntries.length,
  outsideUi: outsideUiEntries.reduce((sum, [, count]) => sum + count, 0),
  outsideUiFiles: outsideUiEntries.length,
};

let failed = false;
for (const [key, limit] of Object.entries(baseline.limits || {})) {
  const value = actual[key] ?? 0;
  console.log(`[inline-style-governance] ${key}: ${value}/${limit}`);
  if (value > limit) {
    failed = true;
    console.error(`[inline-style-governance] ${key} ${value} > ${limit}`);
  }
}

if (failed) {
  console.error('[inline-style-governance] failed. Convert inline styles or update the baseline with a documented reason.');
  process.exit(1);
}

console.log('[inline-style-governance] passed.');

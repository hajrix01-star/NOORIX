/**
 * يتحقق من صياغة سكربتات Node (node --check) — جذر scripts/*.mjs و backend/scripts/*.mjs و *.js
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** @param {string} dir @param {string[]} exts */
function collectFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!fs.statSync(full).isFile()) continue;
    if (exts.includes(path.extname(name))) out.push(full);
  }
  return out;
}

const files = [
  ...collectFiles(path.join(root, 'scripts'), ['.mjs']),
  ...collectFiles(path.join(root, 'backend', 'scripts'), ['.mjs', '.js']),
].sort();

let failed = false;
for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const r = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    failed = true;
    console.error(`[check-node-scripts] FAIL ${rel}`);
    if (r.stderr) console.error(r.stderr.trimEnd());
    if (r.stdout) console.error(r.stdout.trimEnd());
  } else {
    console.log(`[check-node-scripts] ok ${rel}`);
  }
}

if (!files.length) {
  console.warn('[check-node-scripts] no script files found');
}
process.exit(failed ? 1 : 0);

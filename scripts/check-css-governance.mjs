import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const baselinePath = path.join(__dirname, 'css-governance-baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

const checks = [
  ['lines', 'maxLines', (text) => text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0)],
  ['mediaQueries', 'maxMediaQueries', (text) => count(text, /@media\b/g)],
  ['important', 'maxImportant', (text) => count(text, /!important\b/g)],
  ['keyframes', 'maxKeyframes', (text) => count(text, /@keyframes\b/g)],
  ['cssVariableDefinitions', 'maxCssVariableDefinitions', (text) => count(text, /^\s*--[A-Za-z0-9_-]+\s*:/gm)],
  ['cssVariableReferences', 'maxCssVariableReferences', (text) => count(text, /var\(--/g)],
  ['colorMix', 'maxColorMix', (text) => count(text, /color-mix\b/g)],
];

function count(text, pattern) {
  return Array.from(text.matchAll(pattern)).length;
}

let failed = false;
const rows = [];

for (const [rel, limits] of Object.entries(baseline.files || {})) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failed = true;
    console.error(`[css-governance] missing ${rel}`);
    continue;
  }

  const text = fs.readFileSync(full, 'utf8');
  for (const [metric, limitKey, measure] of checks) {
    const actual = measure(text);
    const limit = limits[limitKey];
    rows.push({ file: rel, metric, actual, limit });
    if (actual > limit) {
      failed = true;
      console.error(`[css-governance] ${rel} ${metric} ${actual} > ${limit}`);
    }
  }
}

for (const [rel, groups] of Object.entries(baseline.selectorGroups || {})) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failed = true;
    console.error(`[css-governance] missing ${rel}`);
    continue;
  }

  const text = fs.readFileSync(full, 'utf8');
  for (const [groupName, group] of Object.entries(groups)) {
    const actual = count(text, new RegExp(group.pattern, 'g'));
    const limit = group.maxMatches;
    rows.push({ file: rel, metric: `selectorGroup:${groupName}`, actual, limit });
    if (actual > limit) {
      failed = true;
      console.error(`[css-governance] ${rel} selectorGroup:${groupName} ${actual} > ${limit}`);
    }
  }
}

for (const row of rows) {
  console.log(`[css-governance] ${row.file} ${row.metric}: ${row.actual}/${row.limit}`);
}

if (failed) {
  console.error('[css-governance] failed. Reduce CSS growth or update the baseline with a documented reason.');
  process.exit(1);
}

console.log('[css-governance] passed.');

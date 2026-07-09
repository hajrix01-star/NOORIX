import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const baselinePath = 'scripts/any-typing-baseline.json';
const docPath = 'docs/ANY_TYPING_GOVERNANCE.md';
const baseline = JSON.parse(read(baselinePath));
const allowedCounts = baseline.allowedCounts ?? {};
const docText = read(docPath);

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function fail(message) {
  failures.push(message);
}

function walk(dir, predicate, acc = []) {
  for (const entry of readdirSync(path.join(root, dir))) {
    const relativePath = path.join(dir, entry);
    const fullPath = path.join(root, relativePath);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', 'build', '.git'].includes(entry)) {
        walk(relativePath, predicate, acc);
      }
    } else if (predicate(relativePath)) {
      acc.push(relativePath.replaceAll('\\', '/'));
    }
  }
  return acc;
}

function stripStrings(source) {
  return source
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*\1/g, '')
    .replace(/\bexpect\s*\.\s*any\s*\(/g, 'expectAny(');
}

function countExplicitAny(source) {
  return (stripStrings(source).match(/\bany\b/g) ?? []).length;
}

const sourceFiles = walk('src', (file) => /\.(tsx|ts)$/.test(file));
const currentCounts = {};
for (const file of sourceFiles) {
  const count = countExplicitAny(read(file));
  if (count > 0) currentCounts[file] = count;
}

for (const [file, count] of Object.entries(currentCounts)) {
  const allowed = allowedCounts[file] ?? 0;
  if (count > allowed) {
    fail(`${file}: explicit any count is ${count}, allowed ${allowed}; reduce it or document the current baseline.`);
  }
}

for (const [file, allowed] of Object.entries(allowedCounts)) {
  const current = currentCounts[file] ?? 0;
  if (current < allowed) {
    fail(`${file}: any baseline is stale: allowed ${allowed}, current ${current}. Update ${baselinePath}.`);
  }
}

const totalAny = Object.values(allowedCounts).reduce((sum, count) => sum + count, 0);
const fileCount = Object.keys(allowedCounts).length;
for (const required of [
  'Any Typing Governance',
  '`scripts/any-typing-baseline.json`',
  '`scripts/check-any-typing-governance.mjs`',
  `| Explicit TypeScript \`any\` baseline | ${totalAny} |`,
  `| Files with explicit \`any\` baseline | ${fileCount} |`,
]) {
  if (!docText.includes(required)) {
    fail(`${docPath}: stale or missing required note: ${required}`);
  }
}

if (failures.length > 0) {
  console.error('Any typing governance check failed:\n');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Any typing governance check passed.');

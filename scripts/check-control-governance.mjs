import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

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

function fail(file, message) {
  failures.push(`${file} - ${message}`);
}

const registryPath = 'scripts/control-manual-exceptions.json';
const registry = JSON.parse(read(registryPath));
const allowedRawButtonCounts = registry.allowedRawButtonCounts ?? {};
const allowedRawFormControlCounts = registry.allowedRawFormControlCounts ?? {};
const sourceFiles = walk('src', (file) => /\.(tsx|jsx)$/.test(file));

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function checkRegistry(kind, currentCounts, allowedCounts, recommendation) {
  for (const [file, count] of Object.entries(currentCounts)) {
    const allowed = allowedCounts[file] ?? 0;
    if (count > allowed) {
      fail(file, `${kind} count is ${count}, allowed ${allowed}; ${recommendation} or update ${registryPath} with a documented exception`);
    }
  }

  for (const [file, allowed] of Object.entries(allowedCounts)) {
    const current = currentCounts[file] ?? 0;
    if (current < allowed) {
      fail(file, `${kind} registry is stale: allowed ${allowed}, current ${current}`);
    }
  }
}

const currentRawButtonCounts = {};
const currentRawFormControlCounts = {};

for (const file of sourceFiles) {
  if (file.startsWith('src/ui/')) continue;
  const text = read(file);
  const rawButtons = countMatches(text, /<button\b/g);
  const rawFormControls = countMatches(text, /<(input|select|textarea)\b/g);

  if (rawButtons > 0) currentRawButtonCounts[file] = rawButtons;
  if (rawFormControls > 0) currentRawFormControlCounts[file] = rawFormControls;
}

checkRegistry('raw <button>', currentRawButtonCounts, allowedRawButtonCounts, 'use src/ui/Button');
checkRegistry('raw form control', currentRawFormControlCounts, allowedRawFormControlCounts, 'use src/ui/Input for simple text/number/date/search/select controls');

if (failures.length > 0) {
  console.error('Control governance check failed:\n');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Control governance check passed.');

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

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

const registryPath = 'scripts/date-control-exceptions.json';
const registry = JSON.parse(read(registryPath));
const allowedDateInputCounts = registry.allowedDateInputCounts ?? {};
const reasonsPath = 'scripts/date-control-reasons.json';
const reasons = JSON.parse(read(reasonsPath));
const dateInputReasons = reasons.dateInputReasons ?? {};
const sourceFiles = walk('src', (file) => /\.(tsx|jsx)$/.test(file));
const currentDateInputCounts = {};

for (const file of sourceFiles) {
  if (file.startsWith('src/ui/')) continue;
  const text = read(file);
  const dateInputs = countMatches(text, /\btype=["']date["']/g);
  if (dateInputs > 0) currentDateInputCounts[file] = dateInputs;
}

for (const [file, count] of Object.entries(currentDateInputCounts)) {
  const allowed = allowedDateInputCounts[file] ?? 0;
  if (count > allowed) {
    fail(file, `date input count is ${count}, allowed ${allowed}; use src/ui/date/DateField or update ${registryPath} with a documented exception`);
  }
}

for (const [file, allowed] of Object.entries(allowedDateInputCounts)) {
  const current = currentDateInputCounts[file] ?? 0;
  if (current < allowed) {
    fail(file, `date input registry is stale: allowed ${allowed}, current ${current}`);
  }
  const reason = dateInputReasons[file];
  if (!reason?.category || !reason?.decision || !reason?.reason) {
    fail(file, `${file} is missing a documented reason in ${reasonsPath}`);
  }
}

for (const file of Object.keys(dateInputReasons)) {
  if (!(file in allowedDateInputCounts)) {
    fail(file, `${file} reason is stale: no matching entry in ${registryPath}`);
  }
}

if (failures.length > 0) {
  console.error('Date control governance check failed:\n');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Date control governance check passed.');

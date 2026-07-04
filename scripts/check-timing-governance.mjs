import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

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

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function fail(file, message) {
  failures.push(`${file} - ${message}`);
}

const sourceFiles = walk('src', (file) => /\.(tsx|ts|jsx|js)$/.test(file));
const docsFiles = walk('docs', (file) => /\.md$/.test(file));

for (const file of sourceFiles) {
  const normalized = file.replaceAll('\\', '/');
  if (normalized === 'src/hooks/useDebouncedValue.ts') continue;
  const text = read(file);
  if (text.includes('hooks/useDebouncedValue')) {
    fail(file, 'useDebouncedValue must be imported from src/ui, not src/hooks/useDebouncedValue');
  }
}

for (const file of docsFiles) {
  const text = read(file);
  if (text.includes('src/hooks/useDebouncedValue.js')) {
    fail(file, 'timing docs are stale: use src/ui/timing.ts');
  }
}

if (failures.length > 0) {
  console.error('Timing governance check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Timing governance check passed.');

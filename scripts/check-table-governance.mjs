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

function fail(file, line, message) {
  failures.push(`${file}${line ? `:${line}` : ''} - ${message}`);
}

const governanceDoc = '.cursor/rules/tables-audit.mdc';
const governanceText = read(governanceDoc);
for (const required of [
  'Table Governance Addendum',
  'مصدر الحقيقة النهائي للجداول',
  'Checklist إغلاق الجداول',
  '--noorix-table-*',
]) {
  if (!governanceText.includes(required)) {
    fail(governanceDoc, null, `missing required governance section: ${required}`);
  }
}

const cssFiles = walk('src', (file) => file.endsWith('.css'));
for (const file of cssFiles) {
  const text = read(file);
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (line.includes('--nx-table-head-bg:') && !line.includes('var(--noorix-table-header-bg)')) {
      fail(file, lineNo, '--nx-table-head-bg must alias --noorix-table-header-bg');
    }
    if (line.includes('--nx-table-line:') && !line.includes('var(--noorix-table-header-border)')) {
      fail(file, lineNo, '--nx-table-line must alias --noorix-table-header-border');
    }
    if (line.includes('--nx-table-col-line:') && !line.includes('var(--noorix-table-header-border)')) {
      fail(file, lineNo, '--nx-table-col-line must alias --noorix-table-header-border');
    }
  });

  if (file !== 'src/index.css' && /\.noorix-table(?!-)/.test(text)) {
    fail(file, null, '.noorix-table visual rules belong in src/index.css only');
  }
}

const sourceFiles = walk('src', (file) => /\.(tsx|ts|jsx|js)$/.test(file));
const weakHeaderTextPattern =
  /bg-\[var\(--noorix-table-header-bg\)\].*(text-noorix-muted|text-noorix-text)|(text-noorix-muted|text-noorix-text).*bg-\[var\(--noorix-table-header-bg\)\]/;

for (const file of sourceFiles) {
  const lines = read(file).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (weakHeaderTextPattern.test(line)) {
      fail(file, index + 1, 'table header background must not use muted/default text color');
    }
  });
}

if (failures.length > 0) {
  console.error('Table governance check failed:\n');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Table governance check passed.');

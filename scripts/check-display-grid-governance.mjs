import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const registryPath = 'scripts/display-grid-reasons.json';
const docPath = 'docs/DISPLAY_GRID_GOVERNANCE.md';
const registry = JSON.parse(read(registryPath));
const grids = registry.grids ?? {};
const docText = read(docPath);

const allowedCategories = new Set([
  'calendar-grid',
  'editable-tax-grid',
  'key-value-grid',
  'warranty-queue-grid',
]);

const allowedDecisions = new Set([
  'leave-central-component',
  'leave-protected',
  'future-central-grid',
]);

const tableLikeGridPatterns = [
  {
    pattern: 'grid-cols-[minmax(0,2fr)_1fr_1fr_88px]',
    reason: 'table-like fixed column display grid',
  },
  {
    pattern: 'noorix-calendar-grid-scroll',
    reason: 'calendar display grid shell',
  },
  {
    pattern: 'function BackupCountsGrid',
    reason: 'key-value count grid component',
  },
  {
    pattern: 'nx-assets-warranty-queue__grid',
    reason: 'warranty queue display grid',
  },
  {
    pattern: 'role="table"',
    reason: 'ARIA table display grid',
  },
];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function fail(file, message) {
  failures.push(`${file} - ${message}`);
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

for (const [file, entry] of Object.entries(grids)) {
  const text = read(file);
  if (!entry.category || !allowedCategories.has(entry.category)) {
    fail(file, `display-grid category "${entry.category}" is not governed`);
  }
  if (!entry.decision || !allowedDecisions.has(entry.decision)) {
    fail(file, `display-grid decision "${entry.decision}" is not governed`);
  }
  if (!entry.reason) {
    fail(file, 'display-grid entry must include a reason');
  }
  if (!entry.marker || !text.includes(entry.marker)) {
    fail(file, `display-grid marker "${entry.marker}" is missing or stale`);
  }
}

const sourceFiles = walk('src', (file) => /\.(tsx|ts|jsx|js)$/.test(file));
for (const file of sourceFiles) {
  const text = read(file);
  for (const { pattern, reason } of tableLikeGridPatterns) {
    if (text.includes(pattern) && !(file in grids)) {
      fail(file, `${reason} must be registered in ${registryPath}`);
    }
  }
}

for (const required of [
  'Display Grid Governance',
  '`SmartTable`',
  '`SimpleTable`',
  '`MatrixTable`',
  '`scripts/display-grid-reasons.json`',
  '`npm.cmd run check:display-grid-governance`',
  `| Governed display-grid files | ${Object.keys(grids).length} |`,
]) {
  if (!docText.includes(required)) {
    fail(docPath, `display-grid governance doc is stale or missing: ${required}`);
  }
}

if (failures.length > 0) {
  console.error('Display grid governance check failed:\n');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Display grid governance check passed.');

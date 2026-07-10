import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures = [];

const allowedSummaryBarFiles = new Set([
  'src/ui/SummaryBar.tsx',
]);

function abs(rel) {
  return path.join(root, rel);
}

function read(rel) {
  return fs.existsSync(abs(rel)) ? fs.readFileSync(abs(rel), 'utf8') : '';
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

for (const required of [
  'src/ui/SummaryBar.tsx',
  'src/ui/SummaryBar.test.tsx',
  'src/ui/MetricCard.tsx',
]) {
  if (!fs.existsSync(abs(required))) failures.push(`${required}: required KPI/summary primitive file is missing.`);
}

for (const file of walk(abs('src'))) {
  const fileRel = rel(file);
  const source = fs.readFileSync(file, 'utf8');
  if (!allowedSummaryBarFiles.has(fileRel) && source.includes('noorix-summary-bar')) {
    failures.push(`${fileRel}: use the centralized SummaryBar component instead of direct noorix-summary-bar markup.`);
  }
}

const metricCardSource = read('src/ui/MetricCard.tsx');
if (/\bdata\?:\s*any\[\]/.test(metricCardSource) || /\bdata\?:\s*Array<any>/.test(metricCardSource)) {
  failures.push('src/ui/MetricCard.tsx: MetricCard.Spark data must not use any.');
}

const register = read('docs/SECTION_UNIFICATION_REGISTER.md');
for (const required of [
  '## KPI / Summary Primitive Finalization',
  '`check:kpi-summary-governance`',
  'SummaryBar',
]) {
  if (!register.includes(required)) {
    failures.push(`docs/SECTION_UNIFICATION_REGISTER.md: missing KPI/summary register note: ${required}`);
  }
}

if (failures.length) {
  console.error('KPI/Summary governance failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('KPI/Summary governance passed.');

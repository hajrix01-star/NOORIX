import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures = [];

const governanceChecks = [
  'check-system-core-governance.mjs',
  'check-api-contracts-governance.mjs',
  'check-kpi-summary-governance.mjs',
  'check-chart-state-governance.mjs',
  'check-print-export-governance.mjs',
  'check-editable-grid-governance.mjs',
  'check-display-name-governance.mjs',
  'check-official-numbers-governance.mjs',
  'check-accounting-core-boundary-governance.mjs',
  'check-query-date-governance.mjs',
  'check-table-governance.mjs',
  'check-filter-governance.mjs',
  'check-date-control-governance.mjs',
  'check-responsive-governance.mjs',
];

function read(rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function fail(message) {
  failures.push(message);
}

for (const scriptName of governanceChecks) {
  const scriptPath = path.join(root, 'scripts', scriptName);
  if (!fs.existsSync(scriptPath)) {
    fail(`scripts/${scriptName}: consolidated governance dependency is missing.`);
    continue;
  }

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    fail(`scripts/${scriptName}: failed in consolidated governance run.\n${result.stdout}${result.stderr}`.trimEnd());
  } else {
    const line = (result.stdout || '').trim().split(/\r?\n/).filter(Boolean).at(-1);
    console.log(`[system-governance] ok ${scriptName}${line ? ` - ${line}` : ''}`);
  }
}

const packageJson = read('package.json');
if (!packageJson.includes('"check:system-governance-consolidated": "node scripts/check-system-governance-consolidated.mjs"')) {
  fail('package.json: missing check:system-governance-consolidated script.');
}

const register = read('docs/SECTION_UNIFICATION_REGISTER.md');
for (const required of [
  '## System Governance Consolidation Batch',
  '`check:system-governance-consolidated`',
  'System-governance umbrella',
]) {
  if (!register.includes(required)) {
    fail(`docs/SECTION_UNIFICATION_REGISTER.md: missing consolidated governance register note: ${required}`);
  }
}

const stalePendingMatches = register.match(/Closure commit is pending local commit/g) ?? [];
if (stalePendingMatches.length > 0) {
  fail(`docs/SECTION_UNIFICATION_REGISTER.md: ${stalePendingMatches.length} finalization entries still say "Closure commit is pending local commit".`);
}

for (const staleBacklog of [
  'Expanded governance that prevents new local financial formulas, local date query serialization, raw filters, or section-specific card primitives once final system primitives exist.',
]) {
  if (register.includes(staleBacklog)) {
    fail(`docs/SECTION_UNIFICATION_REGISTER.md: stale backlog item is already covered by consolidated governance: ${staleBacklog}`);
  }
}

if (failures.length) {
  console.error('System governance consolidation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('System governance consolidation passed.');

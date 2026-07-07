import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures = [];

function abs(rel) {
  return path.join(root, rel);
}

function read(rel) {
  return fs.existsSync(abs(rel)) ? fs.readFileSync(abs(rel), 'utf8') : '';
}

function fail(rel, message) {
  failures.push(`${rel}: ${message}`);
}

const requiredFiles = [
  'src/utils/displayName.ts',
  'src/utils/displayName.test.ts',
  'src/utils/vaultDisplay.ts',
  'src/utils/employeeDisplayName.ts',
  'src/modules/Suppliers/supplierDisplayModel.ts',
  'src/modules/Dashboard/utils/dashboardDisplayName.ts',
  'src/modules/Owner/utils/ownerDashboardDisplay.ts',
  'src/modules/Expenses/expenseModels.ts',
  'src/modules/Assets/assetsRegisterModel.ts',
  'src/modules/HajriTax/hajriRegistryMetrics.ts',
];

for (const rel of requiredFiles) {
  if (!fs.existsSync(abs(rel))) fail(rel, 'required display-name file is missing.');
}

for (const rel of [
  'src/utils/displayName.ts',
  'src/utils/vaultDisplay.ts',
  'src/utils/employeeDisplayName.ts',
]) {
  const source = read(rel);
  if (/:\s*any\b|as\s+any\b|@ts-ignore|@ts-expect-error|eslint-disable|\bTODO\b|\bFIXME\b/.test(source)) {
    fail(rel, 'display-name utilities must stay strict and suppression-free.');
  }
}

const displayName = read('src/utils/displayName.ts');
for (const required of [
  'export function localizedDisplayName',
  'export function localizedSecondaryDisplayName',
  'nameAr',
  'nameEn',
  'name',
]) {
  if (!displayName.includes(required)) fail('src/utils/displayName.ts', `missing central display-name behavior: ${required}`);
}

const vaultDisplay = read('src/utils/vaultDisplay.ts');
if (!vaultDisplay.includes("from './displayName'")) {
  fail('src/utils/vaultDisplay.ts', 'vaultDisplay must delegate to the central displayName utility.');
}
if (/function\s+cleanDisplayPart|function\s+localizedDisplayName/.test(vaultDisplay)) {
  fail('src/utils/vaultDisplay.ts', 'vaultDisplay must not own the generic display-name implementation.');
}

for (const rel of [
  'src/utils/employeeDisplayName.ts',
  'src/modules/Suppliers/supplierDisplayModel.ts',
  'src/modules/Dashboard/utils/dashboardDisplayName.ts',
  'src/modules/Owner/utils/ownerDashboardDisplay.ts',
  'src/modules/Expenses/expenseModels.ts',
  'src/modules/Assets/assetsRegisterModel.ts',
  'src/modules/HajriTax/hajriRegistryMetrics.ts',
]) {
  if (!read(rel).includes('localizedDisplayName')) {
    fail(rel, 'closed display-name boundary must use localizedDisplayName.');
  }
}

const register = read('docs/SECTION_UNIFICATION_REGISTER.md');
for (const required of [
  '## Display Name Foundation Finalization',
  '`check:display-name-governance`',
  'nameAr',
  'nameEn',
  'name',
]) {
  if (!register.includes(required)) {
    fail('docs/SECTION_UNIFICATION_REGISTER.md', `missing display-name register note: ${required}`);
  }
}

if (failures.length) {
  console.error('Display-name governance failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Display-name governance passed.');

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures = [];

const allowedUrlSearchParamsFiles = new Map([
  ['src/App.tsx', 'app shell one-time route migration'],
  ['src/hooks/useTabSearchParam.ts', 'central tab search-param hook'],
  ['src/modules/HajriTax/hajriTaxNavigationModel.ts', 'central HajriTax detail navigation model'],
  ['src/modules/HajriTax/useHajriTaxScreen.ts', 'protected detail deep-link cleanup until moved to a URL model'],
  ['src/modules/HR/hrScreenNavigation.ts', 'central HR screen navigation model'],
  ['src/modules/HR/utils/payrollSalaryInvoiceHref.ts', 'salary invoice link model'],
  ['src/utils/reportDrillLinks.ts', 'central report drill-link builder'],
]);

const allowedIsoSerializationFiles = new Map([
  ['src/modules/HajriTax/HajriTaxBulkImportModal.tsx', 'import metadata timestamp'],
  ['src/modules/HajriTax/useHajriTaxExports.ts', 'export metadata timestamp'],
  ['src/modules/HajriTax/useHajriTaxScreen.ts', 'import metadata timestamp'],
  ['src/modules/Reports/costAccountingAppsModel.ts', 'cost-accounting scenario model date normalization'],
  ['src/modules/Reports/costAccountingAppsScenario.ts', 'scenario export metadata timestamp'],
  ['src/modules/Reports/costAccountingApps/useCostAccountingAppsSavedScenarios.ts', 'local saved-scenario metadata timestamp'],
  ['src/modules/Reports/costAccountingAppsSavedSlots.ts', 'local saved-scenario metadata timestamp'],
  ['src/modules/SmartChat/chatStorage.ts', 'local chat storage metadata timestamp'],
  ['src/modules/SmartChat/utils/smartChatMappers.ts', 'chat message metadata timestamp fallback'],
  ['src/utils/printUtils.ts', 'central print filename timestamp helper'],
  ['src/utils/saudiDate.ts', 'central date conversion utility'],
]);

const allowedApiMidnightPayloadFiles = new Map([
  ['src/modules/HR/components/HrQuickEntrySheet/utils/hrQuickEntryMappers.ts', 'HR quick-entry leave API payload mapper'],
  ['src/modules/HR/components/LeaveFormModal.tsx', 'HR leave payload boundary'],
  ['src/modules/HR/components/PayrollRunFormModal/hooks/usePayrollRunFormActions.ts', 'HR payroll run payload boundary'],
  ['src/modules/HR/components/ResidencyFormModal.tsx', 'HR residency payload boundary'],
]);

function abs(rel) {
  return path.join(root, rel);
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function read(relPath) {
  const file = abs(relPath);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function fail(fileRel, message) {
  failures.push(`${fileRel}: ${message}`);
}

function isTestFile(fileRel) {
  return /\.(test|spec)\.(ts|tsx)$/.test(fileRel);
}

for (const [fileRel] of [
  ...allowedUrlSearchParamsFiles,
  ...allowedIsoSerializationFiles,
  ...allowedApiMidnightPayloadFiles,
]) {
  if (!fs.existsSync(abs(fileRel))) fail(fileRel, 'documented query/date boundary file is missing.');
}

for (const file of walk(abs('src'))) {
  const fileRel = rel(file);
  if (isTestFile(fileRel)) continue;
  const source = fs.readFileSync(file, 'utf8');

  if (/\bnew\s+URLSearchParams\s*\(/.test(source)) {
    const isEndpointBuilder = fileRel.startsWith('src/services/domains/apiEndpoints/');
    if (!isEndpointBuilder && !allowedUrlSearchParamsFiles.has(fileRel)) {
      fail(fileRel, 'raw URLSearchParams must live in a central endpoint, navigation, or drill-link model.');
    }
  }

  if (/\bnew\s+Date\s*\([^)]*\)\.toISOString\s*\(/.test(source) || /\bnew\s+Date\s*\([^)]*\)\.toISOString\s*\(\)\.slice\s*\(/.test(source)) {
    if (!allowedIsoSerializationFiles.has(fileRel)) {
      fail(fileRel, 'raw ISO timestamp serialization must live in a central date utility or documented metadata/export/model boundary.');
    }
  }

  if (/T00:00:00\.000Z|T23:59:59\.999Z/.test(source) && !allowedApiMidnightPayloadFiles.has(fileRel)) {
    fail(fileRel, 'raw API midnight date serialization must move to a central endpoint/payload model or be documented as a protected boundary.');
  }
}

const packageJson = read('package.json');
if (!packageJson.includes('"check:query-date-governance": "node scripts/check-query-date-governance.mjs"')) {
  fail('package.json', 'missing check:query-date-governance script.');
}

const register = read('docs/SECTION_UNIFICATION_REGISTER.md');
for (const phrase of [
  '## Query / Date Boundary Governance Finalization',
  '`check:query-date-governance`',
  'raw URLSearchParams',
  'raw ISO timestamp serialization',
]) {
  if (!register.includes(phrase)) {
    fail('docs/SECTION_UNIFICATION_REGISTER.md', `missing query/date register note: ${phrase}`);
  }
}

if (failures.length) {
  console.error('Query/date governance failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Query/date governance passed.');

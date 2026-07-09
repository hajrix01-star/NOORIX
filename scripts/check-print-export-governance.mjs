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
  'src/utils/printUtils.ts',
  'src/utils/printUtils.test.ts',
  'src/modules/HR/components/EmployeeDocModal/utils/employeeDocPrint.ts',
  'src/modules/HR/components/EmployeeDocModal/types.ts',
];

for (const rel of requiredFiles) {
  if (!fs.existsSync(abs(rel))) fail(rel, 'required print/export governance file is missing.');
}

const printUtils = read('src/utils/printUtils.ts');
for (const pattern of [
  { re: /:\s*any\b/, message: 'explicit any type is not allowed in the central print utility.' },
  { re: /as\s+any\b/, message: 'as any is not allowed in the central print utility.' },
  { re: /catch\s*\([^)]*:\s*any\b/, message: 'catch any is not allowed in the central print utility.' },
  { re: /@ts-ignore|@ts-expect-error|eslint-disable|\bTODO\b|\bFIXME\b/, message: 'suppression comments and TODO/FIXME are not allowed in the central print utility.' },
]) {
  if (pattern.re.test(printUtils)) fail('src/utils/printUtils.ts', pattern.message);
}

for (const exportName of [
  'buildPrintDocumentHtml',
]) {
if (!new RegExp(`export\\s+function\\s+${exportName}\\b`).test(printUtils)) {
    fail('src/utils/printUtils.ts', `missing central export ${exportName}.`);
  }
}
for (const removedRel of [
  'src/modules/Invoices/invoicePrintModel.ts',
  'src/modules/Purchases/batch/purchaseBatchPrintModel.ts',
]) {
  if (fs.existsSync(abs(removedRel))) fail(removedRel, 'legacy current-window print adapter must be removed.');
}
for (const removedExport of ['openPrintWindow', 'printCurrentWindow', 'printCurrentWindowNextFrame', 'printCurrentWindowAfterDelay']) {
  if (new RegExp(`export\\s+function\\s+${removedExport}\\b`).test(printUtils)) {
    fail('src/utils/printUtils.ts', `legacy direct print export ${removedExport} must be removed.`);
  }
}

const employeeDocPrint = read('src/modules/HR/components/EmployeeDocModal/utils/employeeDocPrint.ts');
if (!/buildEmployeeDocPrintHtml[\s\S]*:\s*string/.test(employeeDocPrint)) {
  fail('src/modules/HR/components/EmployeeDocModal/utils/employeeDocPrint.ts', 'employee document print helper must build central print-preview HTML.');
}
if (!employeeDocPrint.includes('buildPrintDocumentHtml')) {
  fail('src/modules/HR/components/EmployeeDocModal/utils/employeeDocPrint.ts', 'employee document print helper must delegate to buildPrintDocumentHtml.');
}
if (/PrintWindowStub/.test(employeeDocPrint)) {
  fail('src/modules/HR/components/EmployeeDocModal/utils/employeeDocPrint.ts', 'employee document print helper must not use a fake print window stub.');
}

const employeeDocTypes = read('src/modules/HR/components/EmployeeDocModal/types.ts');
if (/PrintWindowStub/.test(employeeDocTypes)) {
  fail('src/modules/HR/components/EmployeeDocModal/types.ts', 'fake print window stubs are not allowed after print/export foundation closure.');
}

const register = read('docs/SECTION_UNIFICATION_REGISTER.md');
for (const required of [
  '## Print / Export Foundation Finalization',
  '`check:print-export-governance`',
  'PrintPreviewModal',
]) {
  if (!register.includes(required)) fail('docs/SECTION_UNIFICATION_REGISTER.md', `missing print/export register note: ${required}`);
}

if (failures.length) {
  console.error('Print/export governance failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Print/export governance passed.');

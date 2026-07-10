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
  'src/ui/EditableTextCell.tsx',
  'src/ui/EditableNumberCell.tsx',
  'src/ui/EditableCheckboxCell.tsx',
  'src/ui/EditableControlPrimitives.test.tsx',
  'src/modules/HR/components/PayrollRunFormModal/components/PayrollRunRowsTable.tsx',
  'src/modules/Purchases/components/BatchEditInvoiceLine.tsx',
];

for (const rel of requiredFiles) {
  if (!fs.existsSync(abs(rel))) fail(rel, 'required editable-grid file is missing.');
}

for (const rel of [
  'src/ui/EditableTextCell.tsx',
  'src/ui/EditableNumberCell.tsx',
  'src/ui/EditableCheckboxCell.tsx',
]) {
  const source = read(rel);
  if (/:\s*any\b|as\s+any\b|@ts-ignore|@ts-expect-error|eslint-disable|\bTODO\b|\bFIXME\b/.test(source)) {
    fail(rel, 'editable primitive must stay strict and suppression-free.');
  }
}

const editableNumberCell = read('src/ui/EditableNumberCell.tsx');
for (const required of ['selectOnFocus', "inputMode = 'decimal'", "min = '0'"]) {
  if (!editableNumberCell.includes(required)) {
    fail('src/ui/EditableNumberCell.tsx', `missing governed editable number behavior: ${required}`);
  }
}

const payrollRows = read('src/modules/HR/components/PayrollRunFormModal/components/PayrollRunRowsTable.tsx');
if (!payrollRows.includes('EditableNumberCell')) {
  fail('src/modules/HR/components/PayrollRunFormModal/components/PayrollRunRowsTable.tsx', 'payroll editable money rows must use EditableNumberCell.');
}
if (/import\s+\{[^}]*\bInput\b/.test(payrollRows) || /<Input\b[\s\S]*?type=["']number["']/.test(payrollRows)) {
  fail('src/modules/HR/components/PayrollRunFormModal/components/PayrollRunRowsTable.tsx', 'payroll editable money rows must not use Input type="number".');
}

const purchaseEditLine = read('src/modules/Purchases/components/BatchEditInvoiceLine.tsx');
if (!purchaseEditLine.includes('EditableNumberCell')) {
  fail('src/modules/Purchases/components/BatchEditInvoiceLine.tsx', 'purchase batch editable table amount must use EditableNumberCell.');
}
if (!/EditableNumberCell[\s\S]*aria-label=\{`\$\{t\('total'\)\}/.test(purchaseEditLine)) {
  fail('src/modules/Purchases/components/BatchEditInvoiceLine.tsx', 'purchase batch editable amount cell must keep row-specific aria-label.');
}

const tests = read('src/ui/EditableControlPrimitives.test.tsx');
for (const required of ['selectOnFocus', 'inputmode', 'min']) {
  if (!tests.includes(required)) {
    fail('src/ui/EditableControlPrimitives.test.tsx', `editable primitive tests must cover ${required}.`);
  }
}

const register = read('docs/SECTION_UNIFICATION_REGISTER.md');
for (const required of [
  '## Editable Grid Foundation Finalization',
  '`check:editable-grid-governance`',
  'EditableNumberCell',
]) {
  if (!register.includes(required)) {
    fail('docs/SECTION_UNIFICATION_REGISTER.md', `missing editable-grid register note: ${required}`);
  }
}

if (failures.length) {
  console.error('Editable-grid governance failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Editable-grid governance passed.');

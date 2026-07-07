import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const suppliersRoot = path.join(root, 'src', 'modules', 'Suppliers');
const violations = [];

const requiredFiles = [
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'suppliers-query.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'suppliers-query.test.ts'),
  path.join(root, 'backend', 'src', 'suppliers', 'suppliers-query-contract.util.ts'),
  path.join(suppliersRoot, 'supplierTypes.ts'),
  path.join(suppliersRoot, 'supplierDisplayModel.ts'),
  path.join(suppliersRoot, 'supplierFormModel.ts'),
  path.join(suppliersRoot, 'supplierImportExportModel.ts'),
  path.join(suppliersRoot, 'supplierProfilePrint.ts'),
  path.join(suppliersRoot, 'supplierImportExportModel.test.ts'),
  path.join(suppliersRoot, 'supplierFormModel.test.ts'),
  path.join(suppliersRoot, 'supplierProfilePrint.test.ts'),
];

const strictFiles = [
  path.join(root, 'src', 'hooks', 'useSuppliers.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'suppliers.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'suppliers-query.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'suppliers-query.test.ts'),
  path.join(root, 'src', 'services', 'queryKeys', 'suppliers.ts'),
  path.join(root, 'src', 'components', 'common', 'SupplierSelect.tsx'),
  path.join(root, 'backend', 'src', 'suppliers', 'suppliers.controller.ts'),
  path.join(root, 'backend', 'src', 'suppliers', 'suppliers.service.ts'),
  path.join(root, 'backend', 'src', 'suppliers', 'suppliers-query-contract.util.ts'),
];

function report(filePath, message) {
  violations.push(`${path.relative(root, filePath)}: ${message}`);
}

function collectCodeFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectCodeFiles(fullPath);
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry.name)) strictFiles.push(fullPath);
  }
}

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function inspectStrictFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const source = read(filePath);
  const checks = [
    { pattern: /:\s*any\b/, message: 'explicit any type is not allowed in suppliers closure scope.' },
    { pattern: /\bany\[\]/, message: 'any array type is not allowed in suppliers closure scope.' },
    { pattern: /as\s+any\b/, message: 'as any is not allowed in suppliers closure scope.' },
    { pattern: /Record<[^>\n]*\bany\b[^>\n]*>/, message: 'Record with any is not allowed in suppliers closure scope.' },
    { pattern: /@ts-ignore|@ts-expect-error|eslint-disable/, message: 'compiler or lint suppression is not allowed in suppliers closure scope.' },
    { pattern: /\bTODO\b|\bFIXME\b/, message: 'open TODO/FIXME markers are not allowed in suppliers closure scope.' },
  ];
  for (const check of checks) {
    if (check.pattern.test(source)) report(filePath, check.message);
  }
}

for (const requiredFile of requiredFiles) {
  if (!fs.existsSync(requiredFile)) report(requiredFile, 'required suppliers centrality file is missing.');
}

collectCodeFiles(suppliersRoot);
for (const strictFile of strictFiles) {
  inspectStrictFile(strictFile);
}

const suppliersApiPath = path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'suppliers.ts');
const suppliersApi = read(suppliersApiPath);
if (!suppliersApi.includes("from './suppliers-query'") || !suppliersApi.includes('suppliersListQueryParams')) {
  report(suppliersApiPath, 'suppliers API endpoints must use the central suppliers-query helper.');
}
if (/const\s+params\s*:\s*Record/.test(suppliersApi)) {
  report(suppliersApiPath, 'suppliers API endpoints must not rebuild query params inline.');
}

const queryPath = path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'suppliers-query.ts');
const querySource = read(queryPath);
if (!querySource.includes('normalizeSuppliersListQuery') || !querySource.includes('suppliersListQueryParams')) {
  report(queryPath, 'suppliers query contract must normalize and serialize list params centrally.');
}

const controllerPath = path.join(root, 'backend', 'src', 'suppliers', 'suppliers.controller.ts');
const controllerSource = read(controllerPath);
if (!controllerSource.includes('parseSuppliersListQuery')) {
  report(controllerPath, 'backend suppliers controller must use the central suppliers query contract.');
}
if (/parseInt\s*\(/.test(controllerSource)) {
  report(controllerPath, 'backend suppliers controller must not parse list query params inline.');
}

const uiBoundaryFiles = [
  path.join(suppliersRoot, 'components', 'SupplierImportExport.tsx'),
  path.join(suppliersRoot, 'components', 'SupplierProfileModal.tsx'),
  path.join(suppliersRoot, 'components', 'SupplierForm.tsx'),
  path.join(suppliersRoot, 'components', 'SupplierEditModal.tsx'),
];
for (const filePath of uiBoundaryFiles) {
  const source = read(filePath);
  if (/<table\b/.test(source)) report(filePath, 'raw JSX table is not allowed in suppliers UI components.');
}

const importExportPath = path.join(suppliersRoot, 'components', 'SupplierImportExport.tsx');
const importExportSource = read(importExportPath);
if (!importExportSource.includes('../supplierImportExportModel')) {
  report(importExportPath, 'SupplierImportExport must delegate CSV parsing/building to supplierImportExportModel.');
}
if (/function\s+parseCsv\b|function\s+buildCsv\b/.test(importExportSource)) {
  report(importExportPath, 'SupplierImportExport must not own CSV parser or builder functions.');
}

const profilePath = path.join(suppliersRoot, 'components', 'SupplierProfileModal.tsx');
const profileSource = read(profilePath);
if (!profileSource.includes('../supplierProfilePrint')) {
  report(profilePath, 'SupplierProfileModal must delegate print HTML to supplierProfilePrint.');
}
if (/buildPrintDefinitionTableHtml|buildPrintRecordsTableHtml/.test(profileSource)) {
  report(profilePath, 'SupplierProfileModal must not call low-level print table builders directly.');
}

const suppliersTabPath = path.join(suppliersRoot, 'components', 'SuppliersTab.tsx');
const suppliersTabSource = read(suppliersTabPath);
if (/createSupplier|throwIfApiFailed/.test(suppliersTabSource)) {
  report(suppliersTabPath, 'SuppliersTab import flow must use the central supplier mutation path, not direct supplier API calls.');
}
if (
  /<SupplierProfileModal[\s\S]*supplier=\{profileSupplier\}/.test(suppliersTabSource) &&
  !/\{profileSupplier\s*&&\s*\(/.test(suppliersTabSource)
) {
  report(suppliersTabPath, 'SupplierProfileModal must only mount when a concrete supplier is selected.');
}

const profilePrintPath = path.join(suppliersRoot, 'supplierProfilePrint.ts');
const profilePrintSource = read(profilePrintPath);
if (/sumInvoices|\.reduce\s*\(/.test(profilePrintSource)) {
  report(profilePrintPath, 'supplier profile print must use backend summary totals, not frontend invoice aggregation.');
}
if (!/summary:\s*\{[\s\S]*count:[\s\S]*net:[\s\S]*tax:[\s\S]*total:/.test(profilePrintSource)) {
  report(profilePrintPath, 'supplier profile print must require official summary totals.');
}

for (const filePath of strictFiles) {
  const source = read(filePath);
  if (/fetch\s*\(|useQuery\s*\(|useMutation\s*\(|new URLSearchParams|encodeURIComponent|\?\$\{|\?companyId=/.test(source)) {
    report(filePath, 'raw fetch/query/mutation or hand-built query strings are not allowed in suppliers closure scope.');
  }
}

const registerPath = path.join(root, 'docs', 'SECTION_UNIFICATION_REGISTER.md');
const register = read(registerPath);
if (!register.includes('## Suppliers') || !register.includes('check:suppliers-governance')) {
  report(registerPath, 'section unification register must document suppliers closure and governance.');
}

const roadmapPath = path.join(root, 'docs', 'FILTER_CENTRALITY_ROADMAP.md');
const roadmap = read(roadmapPath);
if (!roadmap.includes('suppliers-query') || !roadmap.includes('check:suppliers-governance')) {
  report(roadmapPath, 'filter centrality roadmap must document suppliers query centrality.');
}

if (violations.length) {
  console.error('Suppliers governance failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Suppliers governance passed.');

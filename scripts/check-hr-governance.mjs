import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const hrRoot = path.join(root, 'src', 'modules', 'HR');

const violations = [];
const strictCodeRoots = [
  hrRoot,
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'hr.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'employees.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'hr-query.ts'),
  path.join(root, 'src', 'hooks', 'useEmployees.ts'),
  path.join(root, 'src', 'utils', 'employeeDisplayName.ts'),
  path.join(root, 'backend', 'src', 'hr'),
  path.join(root, 'backend', 'src', 'employees'),
];

const allowedRawTableFiles = new Set([
  path.join(hrRoot, 'tabs', 'EOSCalcTab.tsx'),
  path.join(hrRoot, 'tabs', 'hrPrintDocumentsTabPrintHtml.ts'),
  path.join(hrRoot, 'tabs', 'payrollTabModel.ts'),
  path.join(hrRoot, 'tabs', 'salaryCalcPrint.ts'),
  path.join(hrRoot, 'components', 'PayrollRunDetailModal.tsx'),
  path.join(hrRoot, 'components', 'PayrollRunFormModal', 'components', 'PayrollRunRowsTable.tsx'),
  path.join(hrRoot, 'components', 'terminationSettlementHelpers.ts'),
  path.join(hrRoot, 'components', 'useAdvanceTableModel.tsx'),
  path.join(hrRoot, 'components', 'EmployeeDocModal', 'components', 'EmployeeDocEmployeeInfoTable.tsx'),
  path.join(hrRoot, 'components', 'EmployeeDocModal', 'components', 'EmployeeDocSalaryBreakdownTable.tsx'),
  path.join(hrRoot, 'utils', 'payrollRunSignatureSlipsPrint.ts'),
]);

const requiredFiles = [
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'hr-query.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'hr-query.test.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'hr.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'employees.ts'),
  path.join(root, 'src', 'services', 'queryKeys', 'hr.ts'),
  path.join(root, 'src', 'services', 'queryKeys', 'employees.ts'),
  path.join(root, 'backend', 'src', 'hr', 'dto', 'hr-query.dto.ts'),
  path.join(root, 'backend', 'src', 'hr', 'hr-query-contract.util.ts'),
  path.join(root, 'backend', 'src', 'hr', 'hr-query-contract.util.spec.ts'),
  path.join(root, 'backend', 'src', 'employees', 'dto', 'employee-list-query.dto.ts'),
  path.join(root, 'backend', 'src', 'employees', 'employee-list-query-contract.util.ts'),
  path.join(root, 'backend', 'src', 'employees', 'employee-list-query-contract.util.spec.ts'),
];

function report(filePath, message) {
  violations.push(`${path.relative(root, filePath)}: ${message}`);
}

function inspectHrFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');

  if (/<select\b/.test(source)) {
    report(filePath, 'raw <select> is not allowed in HR; use Input type="select", SearchableOptionsPicker, or another central ui control.');
  }

  if (!allowedRawTableFiles.has(filePath) && /<table\b/.test(source)) {
    report(filePath, 'raw JSX tables are not allowed in HR screens unless explicitly protected.');
  }
}

function inspectStrictCodeFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const checks = [
    { pattern: /:\s*any\b/, message: 'explicit any type is not allowed in HR closure scope.' },
    { pattern: /as\s+any\b/, message: 'as any is not allowed in HR closure scope.' },
    { pattern: /Record<[^>\n]*\bany\b[^>\n]*>/, message: 'Record<string, any> style contracts are not allowed in HR closure scope.' },
    { pattern: /as\s+(unknown|never)\b/, message: 'unknown/never casts are not allowed as HR escape hatches.' },
    { pattern: /@ts-ignore|@ts-expect-error|eslint-disable/, message: 'compiler/lint suppression is not allowed in HR closure scope.' },
    { pattern: /\bTODO\b|\bFIXME\b/, message: 'TODO/FIXME markers are not allowed in HR closure scope.' },
  ];
  for (const check of checks) {
    if (check.pattern.test(source)) {
      report(filePath, check.message);
    }
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
    inspectHrFile(fullPath);
  }
}

function walkStrictTarget(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      const fullPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        walkStrictTarget(fullPath);
        continue;
      }
      if (/\.(tsx?|jsx?)$/.test(entry.name)) inspectStrictCodeFile(fullPath);
    }
    return;
  }
  if (/\.(tsx?|jsx?)$/.test(targetPath)) inspectStrictCodeFile(targetPath);
}

for (const requiredFile of requiredFiles) {
  if (!fs.existsSync(requiredFile)) {
    report(requiredFile, 'required HR centrality file is missing.');
  }
}

for (const strictRoot of strictCodeRoots) {
  walkStrictTarget(strictRoot);
}

for (const apiFile of [
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'hr.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'employees.ts'),
]) {
  if (!fs.existsSync(apiFile)) continue;
  const source = fs.readFileSync(apiFile, 'utf8');
  if (!source.includes("from './hr-query'")) {
    report(apiFile, 'HR API endpoints must use the central hr-query helper.');
  }
  if (/\?companyId=|companyId=\$\{|encodeURIComponent\(companyId\)|searchParams\.set\(['"]companyId['"]/.test(source)) {
    report(apiFile, 'HR API endpoints must not hand-build companyId query strings.');
  }
}

const hrApiPath = path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'hr.ts');
if (fs.existsSync(hrApiPath)) {
  const source = fs.readFileSync(hrApiPath, 'utf8');
  for (const symbol of [
    'companyEmployeeYearQuery',
    'companyEmployeeIdsQuery',
    'companyPayrollMonthQuery',
    'companyDeleteLeaveQuery',
    'companyDeleteResidencyQuery',
  ]) {
    if (!source.includes(symbol)) {
      report(hrApiPath, `HR API endpoints must use central helper: ${symbol}.`);
    }
  }
  if (/const\s+params:\s*Record<string,\s*string>\s*=\s*companyQuery\(/.test(source)) {
    report(hrApiPath, 'HR API endpoints must not extend companyQuery with ad hoc params; add a central hr-query helper.');
  }
}

const hrQueryPath = path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'hr-query.ts');
if (fs.existsSync(hrQueryPath)) {
  const source = fs.readFileSync(hrQueryPath, 'utf8');
  for (const symbol of [
    'buildHrApiQuery',
    'withHrApiQuery',
    'companyQuery',
    'companyEmployeeQuery',
    'companyEmployeeYearQuery',
    'companyEmployeeIdsQuery',
    'companyPayrollMonthQuery',
    'companyDeleteLeaveQuery',
    'companyDeleteResidencyQuery',
    'normalizeEmployeesPagedQueryInput',
    'buildEmployeesPagedApiQuery',
  ]) {
    if (!source.includes(symbol)) {
      report(hrQueryPath, `missing central HR query helper: ${symbol}.`);
    }
  }
}

const staffListPath = path.join(hrRoot, 'StaffListScreen.tsx');
if (fs.existsSync(staffListPath)) {
  const source = fs.readFileSync(staffListPath, 'utf8');
  if (!source.includes('normalizeEmployeesPagedQueryInput')) {
    report(staffListPath, 'staff list must normalize paged employee query input centrally.');
  }
  if (!source.includes('hrKeys.employeesPaged(employeesPagedQuery)')) {
    report(staffListPath, 'staff list query key must use the normalized employeesPagedQuery object.');
  }
}

const hrQueryKeysPath = path.join(root, 'src', 'services', 'queryKeys', 'hr.ts');
if (fs.existsSync(hrQueryKeysPath)) {
  const source = fs.readFileSync(hrQueryKeysPath, 'utf8');
  if (!source.includes('EmployeesPagedQueryInput')) {
    report(hrQueryKeysPath, 'HR query keys must type employeesPaged with EmployeesPagedQueryInput.');
  }
}

const employeesControllerPath = path.join(root, 'backend', 'src', 'employees', 'employees.controller.ts');
if (fs.existsSync(employeesControllerPath)) {
  const source = fs.readFileSync(employeesControllerPath, 'utf8');
  const findAllBlock = source.match(/findAll\([\s\S]*?\n\s*\}\n\s*\n\s*\/\*\*/)?.[0] ?? source;
  if (!findAllBlock.includes('EmployeeListQueryDto') || !findAllBlock.includes('normalizeEmployeeListQuery')) {
    report(employeesControllerPath, 'employees list route must use EmployeeListQueryDto and normalizeEmployeeListQuery.');
  }
  if (/@Query\('(?:includeTerminated|page|pageSize|tab|q|sortBy|sortDir|bulk)'/.test(findAllBlock)) {
    report(employeesControllerPath, 'employees list route must not define per-field @Query decorators.');
  }
}

const hrControllerPaths = [
  path.join(root, 'backend', 'src', 'hr', 'hr.controller.ts'),
  path.join(root, 'backend', 'src', 'hr', 'hr-support.controller.ts'),
];
const hrControllerSource = hrControllerPaths
  .filter((controllerPath) => fs.existsSync(controllerPath))
  .map((controllerPath) => fs.readFileSync(controllerPath, 'utf8'))
  .join('\n');
if (hrControllerSource) {
  for (const symbol of [
    'HrEmployeeQueryDto',
    'HrYearQueryDto',
    'HrLeavesQueryDto',
    'HrResidenciesQueryDto',
    'HrDeleteLeaveQueryDto',
    'HrDeleteResidencyQueryDto',
    'normalizeHrEmployeeQuery',
    'normalizeHrLeavesQuery',
    'normalizeHrResidenciesQuery',
    'normalizeHrYearQuery',
    'parseHrCsvIds',
  ]) {
    if (!hrControllerSource.includes(symbol)) {
      report(hrControllerPaths[0], `HR controllers must use central backend query contract symbol: ${symbol}.`);
    }
  }
  if (/@Query\('(?:employeeId|year|employeeIds|voidSettlement|payrollMonth|serviceCategory|voidInvoice)'/.test(hrControllerSource)) {
    report(hrControllerPaths[0], 'HR controllers must not define per-field tab query decorators; use HR query DTOs.');
  }
}

const roadmapPath = path.join(root, 'docs', 'FILTER_CENTRALITY_ROADMAP.md');
if (fs.existsSync(roadmapPath)) {
  const roadmap = fs.readFileSync(roadmapPath, 'utf8');
  if (!roadmap.includes('hr-query')) {
    report(roadmapPath, 'roadmap must document the HR query helper.');
  }
  if (!roadmap.includes('check:hr-governance')) {
    report(roadmapPath, 'roadmap must document HR governance.');
  }
  if (!roadmap.includes('HrLeavesQueryDto') || !roadmap.includes('hr-query-contract')) {
    report(roadmapPath, 'roadmap must document the HR backend tab query contract.');
  }
}

walk(hrRoot);

if (violations.length) {
  console.error('HR governance failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('HR governance passed.');

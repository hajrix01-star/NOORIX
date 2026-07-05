import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const hrRoot = path.join(root, 'src', 'modules', 'HR');

const violations = [];

const allowedRawTableFiles = new Set([
  path.join(hrRoot, 'tabs', 'EOSCalcTab.tsx'),
  path.join(hrRoot, 'tabs', 'hrPrintDocumentsTabPrintHtml.ts'),
  path.join(hrRoot, 'tabs', 'PayrollTab.tsx'),
  path.join(hrRoot, 'tabs', 'SalaryCalcTab.tsx'),
  path.join(hrRoot, 'components', 'PayrollRunDetailModal.tsx'),
  path.join(hrRoot, 'components', 'PayrollRunFormModal', 'components', 'PayrollRunRowsTable.tsx'),
  path.join(hrRoot, 'components', 'TerminationSettlementModal.tsx'),
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

for (const requiredFile of requiredFiles) {
  if (!fs.existsSync(requiredFile)) {
    report(requiredFile, 'required HR centrality file is missing.');
  }
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

const hrQueryPath = path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'hr-query.ts');
if (fs.existsSync(hrQueryPath)) {
  const source = fs.readFileSync(hrQueryPath, 'utf8');
  for (const symbol of ['buildHrApiQuery', 'withHrApiQuery', 'companyQuery', 'buildEmployeesPagedApiQuery']) {
    if (!source.includes(symbol)) {
      report(hrQueryPath, `missing central HR query helper: ${symbol}.`);
    }
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

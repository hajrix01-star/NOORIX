import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const reportsRoot = path.join(root, 'src', 'modules', 'Reports');

const violations = [];

const strictCodeFiles = [
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'reports.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'reports-query.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'reports-query.test.ts'),
  path.join(root, 'src', 'hooks', 'useReports.ts'),
  path.join(root, 'src', 'hooks', 'useBankStatementView.ts'),
  path.join(root, 'src', 'constants', 'taxDisclosure.ts'),
];

const requiredFiles = [
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'reports-query.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'reports-query.test.ts'),
  path.join(reportsRoot, 'generalReportV2Model.ts'),
  path.join(reportsRoot, 'generalReportV2Model.spec.ts'),
  path.join(reportsRoot, 'accountingReportPeriodModel.ts'),
  path.join(reportsRoot, 'accountingReportPeriodModel.test.ts'),
  path.join(reportsRoot, 'reportsComparablePeriodModel.ts'),
  path.join(reportsRoot, 'taxReportTabModel.ts'),
  path.join(reportsRoot, 'taxReportTabModel.spec.ts'),
];

const allowedRawTableFiles = new Set([
  path.join(reportsRoot, 'GeneralPlTable.tsx'),
  path.join(reportsRoot, 'GeneralReportV2Screen.tsx'),
  path.join(reportsRoot, 'generalReportV2Model.ts'),
  path.join(reportsRoot, 'ReportsScreen.tsx'),
  path.join(reportsRoot, 'reportsPlMonthPrint.ts'),
  path.join(reportsRoot, 'ReportsDetailModal.tsx'),
  path.join(reportsRoot, 'TaxReportTab.tsx'),
  path.join(reportsRoot, 'taxReportTabModel.ts'),
  path.join(reportsRoot, 'CostAccountingAppsScreen.tsx'),
  path.join(reportsRoot, 'costAccountingApps', 'CostAccountingAppsResultPanels.tsx'),
  path.join(reportsRoot, 'costAccountingApps', 'costAccountingAppsScreenActions.ts'),
  path.join(reportsRoot, 'BankStatementMappingModal.tsx'),
  path.join(reportsRoot, 'bank', 'bankStatementExportPrint.ts'),
]);

function report(filePath, message) {
  violations.push(`${path.relative(root, filePath)}: ${message}`);
}

function inspectStrictCodeFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const source = fs.readFileSync(filePath, 'utf8');
  const checks = [
    { pattern: /:\s*any\b/, message: 'explicit any type is not allowed in reports closure scope.' },
    { pattern: /\bany\[\]/, message: 'any[] is not allowed in reports closure scope.' },
    { pattern: /<\s*any\s*>/, message: 'generic any is not allowed in reports closure scope.' },
    { pattern: /as\s+any\b/, message: 'as any is not allowed in reports closure scope.' },
    { pattern: /as\s+never\b/, message: 'as never is not allowed in reports closure scope.' },
    { pattern: /as\s+unknown\b/, message: 'as unknown is not allowed in reports closure scope.' },
    { pattern: /Record<[^>\n]*\bany\b[^>\n]*>/, message: 'Record<string, any> style contracts are not allowed in reports closure scope.' },
    { pattern: /@ts-ignore|@ts-expect-error|eslint-disable/, message: 'compiler/lint suppression is not allowed in reports closure scope.' },
    { pattern: /\bTODO\b|\bFIXME\b/, message: 'TODO/FIXME markers are not allowed in reports closure scope.' },
  ];
  for (const check of checks) {
    if (check.pattern.test(source)) report(filePath, check.message);
  }
}

function collectStrictReportsFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectStrictReportsFiles(fullPath);
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry.name)) strictCodeFiles.push(fullPath);
  }
}

function walkReportsTables(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkReportsTables(fullPath);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
    const source = fs.readFileSync(fullPath, 'utf8');
    if (!allowedRawTableFiles.has(fullPath) && /<table\b/.test(source)) {
      report(fullPath, 'raw report table is not allowed unless protected in reports governance.');
    }
  }
}

for (const requiredFile of requiredFiles) {
  if (!fs.existsSync(requiredFile)) report(requiredFile, 'required reports centrality file is missing.');
}

collectStrictReportsFiles(reportsRoot);
for (const strictFile of strictCodeFiles) {
  inspectStrictCodeFile(strictFile);
}

const reportsApiPath = path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'reports.ts');
if (fs.existsSync(reportsApiPath)) {
  const source = fs.readFileSync(reportsApiPath, 'utf8');
  if (!source.includes("from './reports-query'")) {
    report(reportsApiPath, 'reports API endpoints must use the central reports-query helper.');
  }
  for (const symbol of [
    'generalProfitLossQuery',
    'generalProfitLossDetailsQuery',
    'generalProfitLossTrendQuery',
    'taxVatReportQuery',
    'vatPlanningListQuery',
    'vatPlanningRegistryQuery',
    'vatPlanningDeleteQuery',
    'periodAnalyticsQuery',
    'withReportsApiQuery',
  ]) {
    if (!source.includes(symbol)) report(reportsApiPath, `reports API endpoints must use central helper: ${symbol}.`);
  }
  if (/const\s+params\s*:\s*Record<string,\s*string>\s*=/.test(source)) {
    report(reportsApiPath, 'reports API endpoints must not rebuild query params inline.');
  }
  if (/encodeURIComponent\(|new URLSearchParams\(|\?\$\{|\?companyId=/.test(source)) {
    report(reportsApiPath, 'reports API endpoints must not hand-build query strings.');
  }
}

const generalV2Path = path.join(reportsRoot, 'GeneralReportV2Screen.tsx');
if (fs.existsSync(generalV2Path)) {
  const source = fs.readFileSync(generalV2Path, 'utf8');
  if (!source.includes('./generalReportV2Model')) {
    report(generalV2Path, 'GeneralReportV2Screen must delegate printable/export row shaping to generalReportV2Model.');
  }
  if (/function\s+buildPrintableReportHtml\b/.test(source)) {
    report(generalV2Path, 'GeneralReportV2Screen must not own printable HTML builders.');
  }
}

const reportsScreenPath = path.join(reportsRoot, 'ReportsScreen.tsx');
if (fs.existsSync(reportsScreenPath)) {
  const source = fs.readFileSync(reportsScreenPath, 'utf8');
  if (source.includes('./reportsPlMonthPrint')) {
    report(reportsScreenPath, 'ReportsScreen must not use the legacy monthly print template.');
  }
  for (const symbol of [
    'openPrintDocumentPreview',
    'buildPrintHtmlTable',
    'profitLossUnifiedPrintCss',
    'comparisonPrintColumns',
    'accountingReportPeriodModel',
  ]) {
    if (!source.includes(symbol)) {
      report(reportsScreenPath, `ReportsScreen unified print must include ${symbol}.`);
    }
  }
  for (const localPeriodHelper of [
    'function sortMonthPeriods',
    'function sortQuarterPeriods',
    'function toggleAccountingMonthPeriod',
    'function toggleAccountingQuarterPeriod',
  ]) {
    if (source.includes(localPeriodHelper)) {
      report(reportsScreenPath, `ReportsScreen must not own accounting period helper: ${localPeriodHelper}.`);
    }
  }
}

const roadmapPath = path.join(root, 'docs', 'FILTER_CENTRALITY_ROADMAP.md');
if (fs.existsSync(roadmapPath)) {
  const roadmap = fs.readFileSync(roadmapPath, 'utf8');
  if (!roadmap.includes('reports-query') || !roadmap.includes('check:reports-governance')) {
    report(roadmapPath, 'roadmap must document reports query centrality and reports governance.');
  }
}

walkReportsTables(reportsRoot);

if (violations.length) {
  console.error('Reports governance failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Reports governance passed.');

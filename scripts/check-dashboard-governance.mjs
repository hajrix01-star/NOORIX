import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dashboardRoot = path.join(root, 'src', 'modules', 'Dashboard');

const allowedRawTableFiles = new Set([]);
const allowedPrintHtmlFiles = new Set([
  path.join(dashboardRoot, 'components', 'DashboardCalendarTab', 'hooks', 'useDashboardCalendarTab.ts'),
]);

const violations = [];

const requiredFiles = [
  path.join(dashboardRoot, 'dashboardPeriodModel.ts'),
  path.join(dashboardRoot, 'dashboardPeriodModel.test.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'dashboard-period-query.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'dashboard-period-query.test.ts'),
  path.join(root, 'backend', 'src', 'common', 'dto', 'dashboard-period-query.dto.ts'),
  path.join(root, 'backend', 'src', 'common', 'dto', 'dashboard-period-query.dto.util.spec.ts'),
];

function report(filePath, message) {
  violations.push(`${path.relative(root, filePath)}: ${message}`);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
    inspectFile(fullPath);
  }
}

function inspectFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');

  if (/<select\b/.test(source)) {
    report(filePath, 'raw <select> is not allowed in dashboard; use SearchableOptionsPicker or a central ui control.');
  }

  if (/<Input\b[^>]*type=["']select["']/.test(source)) {
    report(filePath, 'Input type="select" is not allowed in dashboard; use SearchableOptionsPicker or a central ui control.');
  }

  if (/<div\s+className=["'][^"']*\bnx-toolbar\b/.test(source)) {
    report(filePath, 'local dashboard toolbar markup is not allowed; use Toolbar or FilterToolbar.');
  }

  if (!allowedRawTableFiles.has(filePath) && /<table\b/.test(source)) {
    report(filePath, 'raw JSX tables are not allowed in dashboard screens; use SmartTable/SimpleTable unless explicitly protected.');
  }

  if (!allowedPrintHtmlFiles.has(filePath) && /buildPrintTableHtml\b/.test(source)) {
    report(filePath, 'dashboard print table HTML generation must stay in approved print builders/actions only.');
  }
}

walk(dashboardRoot);

for (const requiredFile of requiredFiles) {
  if (!fs.existsSync(requiredFile)) {
    report(requiredFile, 'required dashboard centrality file is missing.');
  }
}

const dashboardScreenPath = path.join(dashboardRoot, 'DashboardScreen.tsx');
if (fs.existsSync(dashboardScreenPath)) {
  const dashboardScreenSource = fs.readFileSync(dashboardScreenPath, 'utf8');
  if (!dashboardScreenSource.includes('FilterToolbar') || !dashboardScreenSource.includes('DateMonthScopePicker')) {
    report(dashboardScreenPath, 'dashboard period filter must use FilterToolbar and DateMonthScopePicker.');
  }
  if (!dashboardScreenSource.includes('./dashboardPeriodModel')) {
    report(dashboardScreenPath, 'dashboard screen must source period normalization from dashboardPeriodModel.');
  }
}

const appSalesTabPath = path.join(dashboardRoot, 'components', 'DashboardAppSalesTab.tsx');
if (fs.existsSync(appSalesTabPath)) {
  const appSalesTabSource = fs.readFileSync(appSalesTabPath, 'utf8');
  if (!appSalesTabSource.includes('buildDashboardAppSalesYearSpanOptions')) {
    report(appSalesTabPath, 'dashboard app sales year-span options must be sourced from dashboardAppSalesData.');
  }
  if (/YEARS_SPAN_OPTIONS/.test(appSalesTabSource)) {
    report(appSalesTabPath, 'dashboard app sales tab must not define local year-span option constants.');
  }
}

const dashboardOverviewApiPath = path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'dashboard-overview.ts');
if (fs.existsSync(dashboardOverviewApiPath)) {
  const source = fs.readFileSync(dashboardOverviewApiPath, 'utf8');
  if (!source.includes('buildDashboardPeriodQuery')) {
    report(dashboardOverviewApiPath, 'dashboard overview API must build query params through dashboard-period-query.');
  }
  if (/Record<[^>]*>\s*=\s*\{[\s\S]*yearStart/.test(source)) {
    report(dashboardOverviewApiPath, 'dashboard overview API must not rebuild dashboard date query params inline.');
  }
}

const reportingInsightsApiPath = path.join(root, 'src', 'services', 'reportingInsightsApi.ts');
if (fs.existsSync(reportingInsightsApiPath)) {
  const source = fs.readFileSync(reportingInsightsApiPath, 'utf8');
  if (!source.includes('buildDashboardPeriodQuery')) {
    report(reportingInsightsApiPath, 'reporting insights API must share dashboard-period-query.');
  }
  if (/toYmd\(/.test(source)) {
    report(reportingInsightsApiPath, 'reporting insights API must not normalize dashboard dates locally.');
  }
}

const dashboardOverviewDtoPath = path.join(root, 'backend', 'src', 'dashboard', 'dto', 'dashboard-overview-query.dto.ts');
if (fs.existsSync(dashboardOverviewDtoPath)) {
  const source = fs.readFileSync(dashboardOverviewDtoPath, 'utf8');
  if (!source.includes('DashboardPeriodQueryDto')) {
    report(dashboardOverviewDtoPath, 'dashboard overview DTO must extend the shared DashboardPeriodQueryDto.');
  }
  if (source.includes('class-validator') || source.includes('@Matches')) {
    report(dashboardOverviewDtoPath, 'dashboard overview DTO must not duplicate shared dashboard validation decorators.');
  }
}

const dashboardInsightsDtoPath = path.join(root, 'backend', 'src', 'reporting', 'dto', 'dashboard-insights-query.dto.ts');
if (fs.existsSync(dashboardInsightsDtoPath)) {
  const source = fs.readFileSync(dashboardInsightsDtoPath, 'utf8');
  if (!source.includes('DashboardPeriodQueryDto')) {
    report(dashboardInsightsDtoPath, 'dashboard insights DTO must extend the shared DashboardPeriodQueryDto.');
  }
  if (source.includes('class-validator') || source.includes('@Matches')) {
    report(dashboardInsightsDtoPath, 'dashboard insights DTO must not duplicate shared dashboard validation decorators.');
  }
}

const roadmapPath = path.join(root, 'docs', 'FILTER_CENTRALITY_ROADMAP.md');
if (fs.existsSync(roadmapPath)) {
  const roadmap = fs.readFileSync(roadmapPath, 'utf8');
  if (!roadmap.includes('Dashboard')) {
    report(roadmapPath, 'roadmap must document dashboard section status.');
  }
  if (!roadmap.includes('dashboardPeriodModel')) {
    report(roadmapPath, 'roadmap must document the dashboard period model.');
  }
  if (!roadmap.includes('dashboard-period-query')) {
    report(roadmapPath, 'roadmap must document the dashboard API period query helper.');
  }
  if (!roadmap.includes('DashboardPeriodQueryDto')) {
    report(roadmapPath, 'roadmap must document the shared backend dashboard period DTO.');
  }
}

if (violations.length) {
  console.error('Dashboard governance failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Dashboard governance passed.');

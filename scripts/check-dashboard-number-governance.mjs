import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function walk(relativePath, acc = []) {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) return acc;
  for (const entry of readdirSync(fullPath)) {
    const child = path.join(relativePath, entry);
    const childFullPath = path.join(root, child);
    const stat = statSync(childFullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', 'build', '.git'].includes(entry)) walk(child, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/(\.test|\.spec)\.(ts|tsx)$/.test(entry)) {
      acc.push(child.replaceAll('\\', '/'));
    }
  }
  return acc;
}

function fail(file, message) {
  failures.push(`${file} - ${message}`);
}

const dashboardUiFiles = [
  ...walk('src/modules/Dashboard/overview/hooks'),
  ...walk('src/modules/Dashboard/overview/components'),
  ...walk('src/modules/Dashboard/components/DashboardCalendarTab'),
  'src/modules/Dashboard/components/DashboardAppSalesTab.tsx',
  'src/modules/Dashboard/utils/dashboardAppSalesData.ts',
].filter((file, index, all) => all.indexOf(file) === index && existsSync(path.join(root, file)));

const bannedUiPatterns = [
  ['computeRevenueMonthDailyAvg', 'daily averages must come from backend sales metrics'],
  ['computeSalesShiftPeriodTotals', 'shift totals must come from backend sales metrics'],
  ['salesShiftSharePercent', 'shift share percent must come from backend sales metrics'],
  ['buildDashboardAppSalesModelFromMetrics', 'app-sales percentages must come from backend sales metrics'],
  ['buildDashboardWeeklySalesComparisonRowsFromDaily', 'weekly comparison must come from backend sales metrics'],
  ['buildChannelPieRows', 'channel breakdown percentages must come from backend sales metrics'],
  ['buildTopSuppliersChartData', 'supplier percentages must come from backend period analytics'],
  ['buildPurchaseCategoriesData', 'purchase category percentages must come from backend period analytics'],
  ['mergePurchaseCategoriesOthers', 'purchase category grouping must not recalculate official percentages in UI'],
  ['getCardValue', 'KPI card values must come from backend dashboard presentation'],
  ['getPctStringForCard', 'KPI card percentages must come from backend dashboard presentation'],
];

for (const file of dashboardUiFiles) {
  const text = read(file);
  for (const [pattern, reason] of bannedUiPatterns) {
    if (text.includes(pattern)) fail(file, `${pattern}: ${reason}`);
  }
}

const requiredContracts = [
  ['backend/src/dashboard/dashboard.service.ts', 'kpiCards: buildKpiCards'],
  ['backend/src/dashboard/dashboard.service.ts', 'timeline: {'],
  ['backend/src/dashboard/dashboard.service.ts', 'weeklyComparison:'],
  ['backend/src/dashboard/dashboard.service.ts', 'previousMonthAverage:'],
  ['backend/src/sales/sales-dashboard-pack.service.ts', 'dailyTotals: dailyTotalRows'],
  ['backend/src/sales/sales-dashboard-pack.service.ts', 'weekdayAverages: weekdayAverageRows'],
  ['backend/src/sales/sales-dashboard-pack.service.ts', 'dailyWeeklyComparison: weeklyComparisonRows'],
  ['backend/src/sales/sales-dashboard-pack.service.ts', 'shiftTotals: salesShiftTotals'],
  ['backend/src/sales/sales-dashboard-pack.service.ts', 'channelBreakdown: channelBreakdown'],
  ['backend/src/sales/sales-dashboard-pack.service.ts', 'appSales: appSalesModel'],
  ['backend/src/reports/reports-period-analytics.service.ts', 'sharePct'],
  ['src/types/api/domains/dashboard.ts', 'DashboardOverviewPresentation'],
  ['src/types/api/domains/dashboard.ts', 'DashboardSalesPackMetrics'],
];

for (const [file, needle] of requiredContracts) {
  const text = read(file);
  if (!text.includes(needle)) fail(file, `missing dashboard number contract: ${needle}`);
}

const overviewModel = 'src/modules/Dashboard/overview/hooks/useDashboardOverviewModel.ts';
if (read(overviewModel).includes('useDashboardSalesPack')) {
  fail(overviewModel, 'overview must use the single dashboard overview request; do not add side sales-pack requests');
}

if (failures.length > 0) {
  console.error('Dashboard number governance check failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dashboard number governance check passed (${dashboardUiFiles.length} UI files scanned).`);

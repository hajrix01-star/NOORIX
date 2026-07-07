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

for (const required of [
  'src/ui/ChartState.tsx',
  'src/ui/ChartState.test.tsx',
]) {
  if (!fs.existsSync(abs(required))) failures.push(`${required}: required chart state primitive file is missing.`);
}

const chartStateSource = read('src/ui/ChartState.tsx');
if (/\bany\b|as\s+any\b|@ts-ignore|@ts-expect-error|eslint-disable|\bTODO\b|\bFIXME\b/.test(chartStateSource)) {
  failures.push('src/ui/ChartState.tsx: chart state primitive must stay strict and suppression-free.');
}

const closedFiles = [
  'src/modules/Dashboard/overview/components/DashboardOverviewTopCharts.tsx',
  'src/modules/Owner/components/OwnerPerformanceChart.tsx',
  'src/modules/Reports/bank/components/analysis/BankAnalysisCategoryPieCard.tsx',
];

for (const rel of closedFiles) {
  const source = read(rel);
  if (!source) {
    failures.push(`${rel}: closed chart-state file is missing.`);
    continue;
  }
  if (!source.includes('ChartState')) {
    failures.push(`${rel}: closed chart-state file must use ChartState.`);
  }
}

const dashboardTopCharts = read('src/modules/Dashboard/overview/components/DashboardOverviewTopCharts.tsx');
if (/LoadingState|EmptyState/.test(dashboardTopCharts)) {
  failures.push('src/modules/Dashboard/overview/components/DashboardOverviewTopCharts.tsx: use ChartState instead of LoadingState/EmptyState for chart panels.');
}

const ownerChart = read('src/modules/Owner/components/OwnerPerformanceChart.tsx');
if (/text-center\s+text-noorix-muted\s+py-12/.test(ownerChart)) {
  failures.push('src/modules/Owner/components/OwnerPerformanceChart.tsx: use ChartState for no-data chart surface.');
}

const bankPie = read('src/modules/Reports/bank/components/analysis/BankAnalysisCategoryPieCard.tsx');
if (/flex items-center bg-noorix-bg-muted rounded-xl text-\[14px\] text-noorix-muted h-\[320px\]/.test(bankPie)) {
  failures.push('src/modules/Reports/bank/components/analysis/BankAnalysisCategoryPieCard.tsx: use ChartState for empty pie chart surface.');
}

const register = read('docs/SECTION_UNIFICATION_REGISTER.md');
for (const required of [
  '## Chart State Primitive Finalization',
  '`check:chart-state-governance`',
  'ChartState',
]) {
  if (!register.includes(required)) {
    failures.push(`docs/SECTION_UNIFICATION_REGISTER.md: missing Chart State register note: ${required}`);
  }
}

if (failures.length) {
  console.error('Chart State governance failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Chart State governance passed.');

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function walk(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) return walk(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}

function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

const ownerFiles = [
  ...walk('src/modules/Owner'),
  'src/hooks/useOwnerOverview.ts',
  'src/services/domains/apiEndpoints/owner-overview.ts',
  'src/services/queryKeys/owner.ts',
].filter((file) => fs.existsSync(path.join(root, file)));

for (const file of ownerFiles) {
  const source = read(file);
  if (/\bany\b/.test(source)) fail(file, 'owner scope must not use real any');
  if (/eslint-disable|ts-ignore|TODO|FIXME/.test(source)) fail(file, 'owner scope must not carry suppressions or TODO markers');
  if (/ownerDashboardCalculations|useOwnerReports|useOwnerDailySales/.test(source)) {
    fail(file, 'owner scope must use the backend official overview model, not legacy frontend calculation hooks');
  }
  if (/\.reduce\s*\(|\*\s*100|\|\|\s*0|as unknown|as never/.test(source)) {
    fail(file, 'owner frontend must not calculate official numbers or hide missing official values');
  }
}

const backendFiles = walk('backend/src/owner');
for (const file of backendFiles) {
  const source = read(file);
  if (/\bany\b/.test(source)) fail(file, 'owner backend must not use real any');
  if (/eslint-disable|ts-ignore|TODO|FIXME/.test(source)) fail(file, 'owner backend must not carry suppressions or TODO markers');
}

if (fs.existsSync(path.join(root, 'src/modules/Owner/utils/ownerDashboardCalculations.ts'))) {
  fail('src/modules/Owner/utils/ownerDashboardCalculations.ts', 'legacy frontend calculations file must be removed');
}

const controller = read('backend/src/owner/owner.controller.ts');
if (!controller.includes("@RequirePermission('VIEW_OWNER')")) {
  fail('backend/src/owner/owner.controller.ts', 'owner endpoint must align with VIEW_OWNER route permission');
}

const service = read('backend/src/owner/owner.service.ts');
if (!service.includes('buildOwnerOverviewModel')) {
  fail('backend/src/owner/owner.service.ts', 'owner service must return the official backend overview model');
}

if (failures.length) {
  console.error('Owner governance failed:');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Owner governance passed.');

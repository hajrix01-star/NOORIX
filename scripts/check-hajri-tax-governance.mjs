import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const strictTargets = [
  'src/modules/HajriTax',
  'src/hooks/useVatPlanning.ts',
  'src/types/api/domains/hajriTax.ts',
  'backend/src/vat-planning',
];

const requiredFiles = [
  'src/types/api/domains/hajriTax.ts',
  'src/modules/HajriTax/hajriRegistryMetrics.test.ts',
  'backend/src/vat-planning/vat-planning.service.spec.ts',
];

function walk(target, acc = []) {
  const full = path.join(root, target);
  if (!fs.existsSync(full)) return acc;
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(full)) {
      if (['node_modules', 'dist', 'build'].includes(entry)) continue;
      walk(path.join(target, entry), acc);
    }
  } else if (/\.(ts|tsx|js|mjs)$/.test(target)) {
    acc.push(target.replaceAll('\\', '/'));
  }
  return acc;
}

function read(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function fail(file, message) {
  failures.push(`${file} - ${message}`);
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(file, 'required Hajri Tax closure file is missing');
}

for (const file of strictTargets.flatMap((target) => walk(target))) {
  const source = read(file);
  const checks = [
    { pattern: /:\s*any\b/, message: 'explicit any is not allowed in Hajri Tax closure scope' },
    { pattern: /\bany\[\]/, message: 'any[] is not allowed in Hajri Tax closure scope' },
    { pattern: /<\s*any\s*>/, message: 'generic any is not allowed in Hajri Tax closure scope' },
    { pattern: /as\s+any\b/, message: 'as any is not allowed in Hajri Tax closure scope' },
    { pattern: /as\s+never\b/, message: 'as never is not allowed in Hajri Tax closure scope' },
    { pattern: /as\s+unknown\b/, message: 'as unknown is not allowed in Hajri Tax closure scope' },
    { pattern: /Record<[^>\n]*\bany\b[^>\n]*>/, message: 'Record with any is not allowed in Hajri Tax closure scope' },
    { pattern: /useApi(?:List)?Query\s*<\s*any\s*>/, message: 'Hajri Tax queries must not use any' },
    { pattern: /@ts-ignore|@ts-expect-error|eslint-disable/, message: 'compiler or lint suppression is not allowed in Hajri Tax closure scope' },
    { pattern: /\bTODO\b|\bFIXME\b/, message: 'open TODO/FIXME markers are not allowed in Hajri Tax closure scope' },
  ];
  for (const check of checks) {
    if (check.pattern.test(source)) fail(file, check.message);
  }
}

const hook = read('src/hooks/useVatPlanning.ts');
if (!hook.includes('VatPlanningRecord') || !hook.includes('VatPlanningUpsertPayload')) {
  fail('src/hooks/useVatPlanning.ts', 'VAT planning hooks must use the Hajri Tax domain contract');
}
if (!hook.includes('useVatPlanningRegistryMetadata')) {
  fail('src/hooks/useVatPlanning.ts', 'VAT planning hooks must expose registry metadata without loading the full registry');
}

const endpoints = read('src/services/domains/apiEndpoints/reports.ts');
if (!endpoints.includes('ApiParsedResult<VatPlanningRecord[]>') || !endpoints.includes('VatPlanningUpsertPayload')) {
  fail('src/services/domains/apiEndpoints/reports.ts', 'VAT planning endpoints must be typed with the Hajri Tax domain contract');
}
if (!endpoints.includes('ApiParsedResult<VatPlanningRegistryMetadata>')) {
  fail('src/services/domains/apiEndpoints/reports.ts', 'VAT planning registry metadata endpoint must be typed');
}
if (/upsertVatPlanning\(body:\s*unknown/.test(endpoints)) {
  fail('src/services/domains/apiEndpoints/reports.ts', 'upsertVatPlanning must not accept unknown body');
}

const service = read('backend/src/vat-planning/vat-planning.service.ts');
if (!service.includes('normalizePayload') || !service.includes('net_payable_refund')) {
  fail('backend/src/vat-planning/vat-planning.service.ts', 'backend must normalize planning payload summaries before saving');
}
if (!service.includes('registryMetadata') || !service.includes("groupBy({")) {
  fail('backend/src/vat-planning/vat-planning.service.ts', 'backend must expose registry filter metadata without reading full payload rows');
}
if (/payload\s*=\s*dto\.payload\s*\?\?/.test(service)) {
  fail('backend/src/vat-planning/vat-planning.service.ts', 'backend must not persist raw VAT planning payload');
}

const screenHook = read('src/modules/HajriTax/useHajriTaxScreen.ts');
if (/registryAllRows|registryUnfilteredFilters|getCompanies\(false\)|appKeys\.companies/.test(screenHook)) {
  fail('src/modules/HajriTax/useHajriTaxScreen.ts', 'screen hook must not load unfiltered registry rows or companies for filter metadata');
}

if (failures.length) {
  console.error('Hajri Tax governance failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Hajri Tax governance passed.');

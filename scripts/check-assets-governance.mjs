import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const strictTargets = [
  'src/modules/Assets',
  'src/services/domains/apiEndpoints/company-assets.ts',
  'src/services/queryKeys/assets.ts',
  'src/types/api/domains/assets.ts',
  'backend/src/company-assets',
];

const requiredFiles = [
  'src/types/api/domains/assets.ts',
  'src/modules/Assets/assetsRegisterModel.ts',
  'src/modules/Assets/assetsRegisterModel.test.ts',
  'backend/src/company-assets/company-assets.service.spec.ts',
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
  if (!fs.existsSync(path.join(root, file))) fail(file, 'required assets closure file is missing');
}

for (const file of strictTargets.flatMap((target) => walk(target))) {
  const source = read(file);
  const checks = [
    { pattern: /:\s*any\b/, message: 'explicit any is not allowed in assets closure scope' },
    { pattern: /\bany\[\]/, message: 'any[] is not allowed in assets closure scope' },
    { pattern: /<\s*any\s*>/, message: 'generic any is not allowed in assets closure scope' },
    { pattern: /as\s+any\b/, message: 'as any is not allowed in assets closure scope' },
    { pattern: /as\s+never\b/, message: 'as never is not allowed in assets closure scope' },
    { pattern: /as\s+unknown\b/, message: 'as unknown is not allowed in assets closure scope' },
    { pattern: /Record<[^>\n]*\bany\b[^>\n]*>/, message: 'Record with any is not allowed in assets closure scope' },
    { pattern: /useApi(?:List)?Query\s*<\s*any\s*>/, message: 'asset queries must not use any' },
    { pattern: /@ts-ignore|@ts-expect-error|eslint-disable/, message: 'compiler or lint suppression is not allowed in assets closure scope' },
    { pattern: /\bTODO\b|\bFIXME\b/, message: 'open TODO/FIXME markers are not allowed in assets closure scope' },
  ];
  for (const check of checks) {
    if (check.pattern.test(source)) fail(file, check.message);
  }
}

const endpoints = read('src/services/domains/apiEndpoints/company-assets.ts');
for (const required of [
  'Promise<ApiParsedResult<AssetRegisterPage>>',
  'Promise<ApiParsedResult<AssetRegisterItem>>',
  'Promise<ApiParsedResult<PendingWarrantyInvoiceRow[]>>',
  'Promise<ApiParsedResult<AssetRegisterItem>>',
]) {
  if (!endpoints.includes(required)) {
    fail('src/services/domains/apiEndpoints/company-assets.ts', `missing typed asset endpoint contract ${required}`);
  }
}
if (/body:\s*unknown|Promise<ApiParsedResult>\b/.test(endpoints)) {
  fail('src/services/domains/apiEndpoints/company-assets.ts', 'asset endpoints must not use unknown bodies or untyped ApiParsedResult');
}

const dataHook = read('src/modules/Assets/hooks/useAssetsRegisterData.ts');
if (/useApiQuery\s*<\s*any\s*>|mapPendingList|mapRegisterListResponse/.test(dataHook)) {
  fail('src/modules/Assets/hooks/useAssetsRegisterData.ts', 'asset data hook must use typed API contracts without cast mappers');
}

const screen = read('src/modules/Assets/AssetsRegisterScreen.tsx');
if (/suppliers\s+as\s+/.test(screen)) {
  fail('src/modules/Assets/AssetsRegisterScreen.tsx', 'asset screen must not cast suppliers');
}

const form = read('src/modules/Assets/components/AssetFormPanel.tsx');
if (/Number\(|parseInt\(|createCompanyAsset\(\s*body\s*\)/.test(form) && !form.includes('buildAssetCreatePayload')) {
  fail('src/modules/Assets/components/AssetFormPanel.tsx', 'asset form must build payload through assetsRegisterModel');
}

const warrantyPanel = read('src/modules/Assets/components/AssetWarrantyPanel.tsx');
if (/Date\.now|Math\.random/.test(warrantyPanel)) {
  fail('src/modules/Assets/components/AssetWarrantyPanel.tsx', 'warranty line keys must be stable and model-owned');
}
if (!warrantyPanel.includes('buildAssetCompletePayload')) {
  fail('src/modules/Assets/components/AssetWarrantyPanel.tsx', 'warranty panel must build payload through assetsRegisterModel');
}

const service = read('backend/src/company-assets/company-assets.service.ts');
if (!service.includes('sumAcquisitionCostFiltered') || !service.includes('take: 200')) {
  fail('backend/src/company-assets/company-assets.service.ts', 'assets backend must expose filtered summary and limit pending warranty queue');
}

if (failures.length) {
  console.error('Assets governance failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Assets governance passed.');

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
if (!warrantyPanel.includes('completeCompanyAssetFromInvoiceWithAttachment')) {
  fail('src/modules/Assets/components/AssetWarrantyPanel.tsx', 'warranty image upload must happen during warranty completion, not invoice entry');
}

const assetDetailModal = read('src/modules/Assets/components/AssetWarrantyDetailModal.tsx');
if (!assetDetailModal.includes('getCompanyAssetWarrantyAttachmentObjectUrl')) {
  fail('src/modules/Assets/components/AssetWarrantyDetailModal.tsx', 'warranty detail modal must display the saved backend warranty image');
}

const warrantyQueueTable = read('src/modules/Assets/components/AssetsWarrantyQueueTable.tsx');
if (/SmartTable|KebabMenu|<table\b/.test(warrantyQueueTable)) {
  fail('src/modules/Assets/components/AssetsWarrantyQueueTable.tsx', 'warranty queue must use the dedicated queue grid, not SmartTable/raw table/action menu layout');
}
for (const required of [
  'nx-assets-warranty-queue__grid',
  'role="table"',
  'role="columnheader"',
  'nx-assets-warranty-queue__button',
  "t('warrantyQueueComplete')",
]) {
  if (!warrantyQueueTable.includes(required)) {
    fail('src/modules/Assets/components/AssetsWarrantyQueueTable.tsx', `warranty queue grid contract is missing ${required}`);
  }
}

const service = read('backend/src/company-assets/company-assets.service.ts');
if (!service.includes('sumAcquisitionCostFiltered') || !service.includes('take: 200')) {
  fail('backend/src/company-assets/company-assets.service.ts', 'assets backend must expose filtered summary and limit pending warranty queue');
}
if (!service.includes('warrantyAttachmentPath') || !service.includes('ASSET_WARRANTY_ATTACHMENT_MIMES')) {
  fail('backend/src/company-assets/company-assets.service.ts', 'assets backend must own warranty image storage and image-only validation');
}

const controller = read('backend/src/company-assets/company-assets.controller.ts');
if (!controller.includes('complete-from-invoice-with-attachment') || !controller.includes('warranty-attachment')) {
  fail('backend/src/company-assets/company-assets.controller.ts', 'assets controller must expose warranty completion/view attachment endpoints');
}

const schema = read('backend/prisma/schema.prisma');
if (!schema.includes('warrantyAttachmentPath') || !schema.includes('warranty_attachment_path')) {
  fail('backend/prisma/schema.prisma', 'CompanyAsset schema must store warranty attachment metadata');
}

if (failures.length) {
  console.error('Assets governance failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Assets governance passed.');

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const purchasesRoot = path.join(root, 'src', 'modules', 'Purchases');

const violations = [];

const allowedRawTableFiles = new Set([
  path.join(purchasesRoot, 'batch', 'components', 'PurchasesBatchToolbar.tsx'),
  path.join(purchasesRoot, 'components', 'BatchEditPanel.tsx'),
  path.join(purchasesRoot, 'components', 'BatchPrintSheet.tsx'),
]);

const requiredFiles = [
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'purchase-batch-query.ts'),
  path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'purchase-batch-query.test.ts'),
  path.join(root, 'backend', 'src', 'invoice', 'dto', 'purchase-batch-summaries-query.dto.ts'),
  path.join(root, 'backend', 'src', 'invoice', 'purchase-batch-summaries-query-contract.util.ts'),
  path.join(root, 'backend', 'src', 'invoice', 'purchase-batch-summaries-query-contract.util.spec.ts'),
];

function report(filePath, message) {
  violations.push(`${path.relative(root, filePath)}: ${message}`);
}

function inspectFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');

  if (/<select\b/.test(source)) {
    report(filePath, 'raw <select> is not allowed in purchases; use SearchableOptionsPicker or a central ui control.');
  }

  if (/<Input\b[^>]*type=["']select["']/.test(source)) {
    report(filePath, 'Input type="select" is not allowed in purchases; use SearchableOptionsPicker or a central ui control.');
  }

  if (!allowedRawTableFiles.has(filePath) && /<table\b/.test(source)) {
    report(filePath, 'raw JSX tables are not allowed in purchases screens unless explicitly protected.');
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
    inspectFile(fullPath);
  }
}

for (const requiredFile of requiredFiles) {
  if (!fs.existsSync(requiredFile)) {
    report(requiredFile, 'required purchases centrality file is missing.');
  }
}

const purchaseBatchDtoPath = path.join(root, 'backend', 'src', 'invoice', 'dto', 'purchase-batch-summaries-query.dto.ts');
if (fs.existsSync(purchaseBatchDtoPath)) {
  const source = fs.readFileSync(purchaseBatchDtoPath, 'utf8');
  if (!/\bcompanyId\?\s*:\s*string\b/.test(source)) {
    report(
      purchaseBatchDtoPath,
      'purchase batch query DTO must whitelist companyId because CompanyAccessGuard reads it before validation.',
    );
  }
}

const purchasesDataHookPath = path.join(purchasesRoot, 'batch', 'hooks', 'usePurchasesBatchData.ts');
if (fs.existsSync(purchasesDataHookPath)) {
  const source = fs.readFileSync(purchasesDataHookPath, 'utf8');
  if (!source.includes('normalizePurchaseBatchSummariesQueryInput')) {
    report(purchasesDataHookPath, 'purchase batch data hook must normalize cache key input centrally.');
  }
}

const purchasesQueryKeysPath = path.join(root, 'src', 'services', 'queryKeys', 'purchases.ts');
if (fs.existsSync(purchasesQueryKeysPath)) {
  const source = fs.readFileSync(purchasesQueryKeysPath, 'utf8');
  if (!source.includes('PurchaseBatchSummariesQueryInput')) {
    report(purchasesQueryKeysPath, 'purchase query keys must use PurchaseBatchSummariesQueryInput.');
  }
}

const salesSummariesApiPath = path.join(root, 'src', 'services', 'domains', 'apiEndpoints', 'sales-summaries.ts');
if (fs.existsSync(salesSummariesApiPath)) {
  const source = fs.readFileSync(salesSummariesApiPath, 'utf8');
  if (!source.includes('buildPurchaseBatchSummariesApiQuery')) {
    report(salesSummariesApiPath, 'purchase batch API params must be built through purchase-batch-query.');
  }
}

const invoiceControllerPath = path.join(root, 'backend', 'src', 'invoice', 'invoice.controller.ts');
if (fs.existsSync(invoiceControllerPath)) {
  const source = fs.readFileSync(invoiceControllerPath, 'utf8');
  const purchaseBlock = source.match(/async\s+purchaseBatchSummaries\([\s\S]*?\n\s*\}\n\s*\n\s*@Get\('day-close-report'\)/)?.[0] ?? source;
  if (!purchaseBlock.includes('PurchaseBatchSummariesQueryDto') || !purchaseBlock.includes('normalizePurchaseBatchSummariesQuery')) {
    report(invoiceControllerPath, 'purchase batch summaries route must use PurchaseBatchSummariesQueryDto and normalizePurchaseBatchSummariesQuery.');
  }
  if (/@Query\('(?:startDate|endDate|q|lang)'/.test(purchaseBlock)) {
    report(invoiceControllerPath, 'purchase batch summaries route must not define per-field @Query decorators.');
  }
}

const invoiceServicePath = path.join(root, 'backend', 'src', 'invoice', 'invoice.service.ts');
if (fs.existsSync(invoiceServicePath)) {
  const source = fs.readFileSync(invoiceServicePath, 'utf8');
  if (!source.includes('PurchaseBatchSummariesQueryContract')) {
    report(invoiceServicePath, 'invoice service must use PurchaseBatchSummariesQueryContract for purchase batch summaries.');
  }
}

const purchaseBatchUtilPath = path.join(root, 'backend', 'src', 'invoice', 'invoice-purchase-batch-summaries.util.ts');
if (fs.existsSync(purchaseBatchUtilPath)) {
  const source = fs.readFileSync(purchaseBatchUtilPath, 'utf8');
  if (!source.includes('PurchaseBatchSummariesQueryContract')) {
    report(purchaseBatchUtilPath, 'purchase batch summaries util must consume PurchaseBatchSummariesQueryContract.');
  }
}

const roadmapPath = path.join(root, 'docs', 'FILTER_CENTRALITY_ROADMAP.md');
if (fs.existsSync(roadmapPath)) {
  const roadmap = fs.readFileSync(roadmapPath, 'utf8');
  if (!roadmap.includes('purchase-batch-query')) {
    report(roadmapPath, 'roadmap must document the purchase batch query helper.');
  }
  if (!roadmap.includes('PurchaseBatchSummariesQueryDto')) {
    report(roadmapPath, 'roadmap must document the backend purchase batch DTO.');
  }
}

walk(purchasesRoot);

if (violations.length) {
  console.error('Purchases governance failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Purchases governance passed.');

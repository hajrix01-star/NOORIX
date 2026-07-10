import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const strictTargets = [
  'src/modules/SmartChat',
  'src/services/domains/apiEndpoints/chat.ts',
  'src/types/api/domains/chat.ts',
  'backend/src/chat',
  'backend/src/config/gemini.config.ts',
];

const requiredFiles = [
  'src/types/api/domains/chat.ts',
  'src/services/domains/apiEndpoints/chat.ts',
  'src/modules/SmartChat/chatStorage.test.ts',
  'backend/src/chat/chat-financial-metrics.service.ts',
  'backend/src/chat/dto/chat-query.dto.ts',
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
  if (!fs.existsSync(path.join(root, file))) fail(file, 'required chat closure file is missing');
}

for (const file of strictTargets.flatMap((target) => walk(target))) {
  const source = read(file);
  const checks = [
    { pattern: /:\s*any\b/, message: 'explicit any is not allowed in chat closure scope' },
    { pattern: /\bany\[\]/, message: 'any[] is not allowed in chat closure scope' },
    { pattern: /<\s*any\s*>/, message: 'generic any is not allowed in chat closure scope' },
    { pattern: /as\s+any\b/, message: 'as any is not allowed in chat closure scope' },
    { pattern: /as\s+never\b/, message: 'as never is not allowed in chat closure scope' },
    { pattern: /as\s+unknown\b/, message: 'as unknown is not allowed in chat closure scope' },
    { pattern: /Record<[^>\n]*\bany\b[^>\n]*>/, message: 'Record with any is not allowed in chat closure scope' },
    { pattern: /@ts-ignore|@ts-expect-error|eslint-disable/, message: 'compiler or lint suppression is not allowed in chat closure scope' },
    { pattern: /\bTODO\b|\bFIXME\b/, message: 'open TODO/FIXME markers are not allowed in chat closure scope' },
    { pattern: /window\.confirm|window\.print\(/, message: 'direct browser confirm/print is not allowed in chat closure scope' },
  ];
  for (const check of checks) {
    if (check.pattern.test(source)) fail(file, check.message);
  }
}

const connectionBank = read('src/services/domains/apiEndpoints/connection-bank.ts');
if (/chatQuery/.test(connectionBank)) {
  fail('src/services/domains/apiEndpoints/connection-bank.ts', 'chatQuery must stay in the dedicated chat endpoint file');
}

const chatEndpoint = read('src/services/domains/apiEndpoints/chat.ts');
if (!chatEndpoint.includes('Promise<ApiParsedResult<ChatQueryResponse>>')) {
  fail('src/services/domains/apiEndpoints/chat.ts', 'chatQuery must return the central ChatQueryResponse contract');
}

for (const handler of [
  'backend/src/chat/handlers/sales.handler.ts',
  'backend/src/chat/handlers/purchases.handler.ts',
  'backend/src/chat/handlers/expenses.handler.ts',
  'backend/src/chat/handlers/sales-month-compare.handler.ts',
  'backend/src/chat/handlers/finance-ratios.handler.ts',
]) {
  if (/ledgerEntry\.aggregate|getGeneralProfitLoss/.test(read(handler))) {
    fail(handler, 'official chat financial numbers must come from ChatFinancialMetricsService');
  }
}

const expensesHandler = read('backend/src/chat/handlers/expenses.handler.ts');
const financeRatiosHandler = read('backend/src/chat/handlers/finance-ratios.handler.ts');
if (/VIEW_VAULTS/.test(expensesHandler)) {
  fail('backend/src/chat/handlers/expenses.handler.ts', 'expense chat answers must use expense permissions, not vault permissions');
}
if (/VIEW_VAULTS/.test(financeRatiosHandler)) {
  fail('backend/src/chat/handlers/finance-ratios.handler.ts', 'finance ratio expense access must use expense permissions, not vault permissions');
}

if (failures.length) {
  console.error('Chat governance failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Chat governance passed.');

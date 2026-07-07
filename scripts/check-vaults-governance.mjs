import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const strictTargets = [
  'src/modules/Treasury',
  'src/hooks/useVaults.ts',
  'src/services/domains/apiEndpoints/vaults.ts',
  'src/services/queryKeys/vaults.ts',
  'src/types/api/domains/vaults.ts',
  'src/utils/vaultDisplay.ts',
  'backend/src/vaults',
  'backend/src/vault-balance',
];

const requiredFiles = [
  'src/types/api/domains/vaults.ts',
  'src/modules/Treasury/treasuryModels.ts',
  'src/modules/Treasury/treasuryModels.test.ts',
  'backend/src/vaults/vaults-find-one-with-transactions.util.spec.ts',
  'backend/src/vaults/vaults.service.spec.ts',
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

function fail(file, message) {
  failures.push(`${file} - ${message}`);
}

function read(file) {
  return fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '';
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(file, 'required vaults closure file is missing');
}

for (const file of strictTargets.flatMap((target) => walk(target))) {
  const source = read(file);
  const checks = [
    { pattern: /:\s*any\b/, message: 'explicit any is not allowed in vaults closure scope' },
    { pattern: /\bany\[\]/, message: 'any[] is not allowed in vaults closure scope' },
    { pattern: /<\s*any\s*>/, message: 'generic any is not allowed in vaults closure scope' },
    { pattern: /as\s+any\b/, message: 'as any is not allowed in vaults closure scope' },
    { pattern: /as\s+never\b/, message: 'as never is not allowed in vaults closure scope' },
    { pattern: /as\s+unknown\b/, message: 'as unknown is not allowed in vaults closure scope' },
    { pattern: /Record<[^>\n]*\bany\b[^>\n]*>/, message: 'Record with any is not allowed in vaults closure scope' },
    { pattern: /@ts-ignore|@ts-expect-error|eslint-disable/, message: 'compiler or lint suppression is not allowed in vaults closure scope' },
    { pattern: /\bTODO\b|\bFIXME\b/, message: 'open TODO/FIXME markers are not allowed in vaults closure scope' },
  ];
  for (const check of checks) {
    if (check.pattern.test(source)) fail(file, check.message);
  }
}

const treasuryScreen = read('src/modules/Treasury/TreasuryScreen.tsx');
if (/sumAmounts\(|\.reduce\(/.test(treasuryScreen)) {
  fail('src/modules/Treasury/TreasuryScreen.tsx', 'TreasuryScreen must not calculate official summary numbers inline');
}

const transactionsModal = read('src/modules/Treasury/components/VaultTransactionsModal.tsx');
if (/new Date\(\)|getMonth\(|T23:59:59\+03:00|vault\?\.totalIn|vault\?\.totalOut/.test(transactionsModal)) {
  fail('src/modules/Treasury/components/VaultTransactionsModal.tsx', 'vault transaction period totals must come from backend without local date or total fallback');
}
if (!transactionsModal.includes('periodTotalIn') || !transactionsModal.includes('periodTotalOut')) {
  fail('src/modules/Treasury/components/VaultTransactionsModal.tsx', 'vault transaction modal must use backend period totals');
}

const formModal = read('src/modules/Treasury/components/VaultFormModal.tsx');
if (/custom:|customEmoji|vaultTypeCustom|ICON_CHARS/.test(formModal)) {
  fail('src/modules/Treasury/components/VaultFormModal.tsx', 'vault form must not expose unsupported custom vault types');
}

const findOneUtil = read('backend/src/vaults/vaults-find-one-with-transactions.util.ts');
if (!findOneUtil.includes('periodTotalIn') || !findOneUtil.includes('periodTotalOut')) {
  fail('backend/src/vaults/vaults-find-one-with-transactions.util.ts', 'backend vault transactions must expose official period totals');
}

const service = read('backend/src/vaults/vaults.service.ts');
if (!/\{\s*debitAccountId:\s*vault\.accountId\s*\}/.test(service) || !/\{\s*creditAccountId:\s*vault\.accountId\s*\}/.test(service)) {
  fail('backend/src/vaults/vaults.service.ts', 'vault deletion guard must check ledger debit and credit account references');
}

if (failures.length) {
  console.error('Vaults governance failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Vaults governance passed.');

import type {
  BankBalanceVerification,
  BankStatementLite,
  BankTransactionLite,
} from './bankAnalysisTab.types';

export function num(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getTxKey(tx: BankTransactionLite): string {
  if (tx.id) return tx.id;
  return `${tx.txDate || ''}_${(tx.description || '').slice(0, 40)}_${num(tx.debit)}_${num(tx.credit)}_${num(tx.balance)}`;
}

export const FALLBACK_CATEGORIES = [
  'POS revenue',
  'POS sales',
  'Delivery apps',
  'Transfer',
  'Transfers',
  'Instant transfer',
  'Salaries',
  'Rent',
  'Electricity',
  'Water',
  'Sadad bills',
  'Telecom',
  'Bank fees',
  'Cash withdrawal',
  'Cash deposit',
  'Zakat and tax',
  'Taxes',
  'Government fees',
  'Purchases',
  'Other expenses',
  'Other income',
  'Uncategorized',
] as const;

export type BankCategoryAgg = { count: number; totalDebit: number; totalCredit: number };
export type BankCashFlowPoint = { date?: string | null; net: number; cumulative: number };
export type BankDailyChartPoint = { date: string; deposits: number; withdrawals: number; balance: number; dateLabel: string; net: number };
export type BankPosTerminalAgg = { terminalId: string; count: number; total: number };
export type BankDepositCategoryAgg = { name: string; count: number; total: number };

export function buildSummaryByCategory(
  transactions: readonly BankTransactionLite[] = [],
  uncategorizedLabel = '-',
): Record<string, BankCategoryAgg> {
  const map: Record<string, BankCategoryAgg> = {};
  for (const tx of transactions) {
    const name = tx.category?.nameAr || tx.category?.nameEn || uncategorizedLabel || '-';
    if (!map[name]) map[name] = { count: 0, totalDebit: 0, totalCredit: 0 };
    map[name].count += 1;
    map[name].totalDebit += num(tx.debit);
    map[name].totalCredit += num(tx.credit);
  }
  return map;
}

export function computeBalanceVerification(statement: BankStatementLite | null | undefined): BankBalanceVerification | null {
  if (!statement) return null;
  const txs = statement.transactions || [];
  if (!txs.length) return null;

  const totalDeposits = txs.reduce((sum, tx) => sum + num(tx.credit), 0);
  const totalWithdrawals = txs.reduce((sum, tx) => sum + num(tx.debit), 0);
  const stmtDeposits = num(statement.totalDeposits);
  const stmtWithdrawals = num(statement.totalWithdrawals);
  const depositsDiff = Math.abs(totalDeposits - stmtDeposits);
  const withdrawalsDiff = Math.abs(totalWithdrawals - stmtWithdrawals);

  const first = txs[0];
  const last = txs[txs.length - 1];
  const descending = String(first?.txDate || '') > String(last?.txDate || '');
  const sorted = descending ? [...txs].reverse() : [...txs];

  let balanceSequenceValid = true;
  const balanceErrors: BankBalanceVerification['balanceErrors'] = [];
  for (let i = 1; i < sorted.length; i++) {
    const tx = sorted[i];
    const prev = sorted[i - 1];
    const prevBal = num(prev.balance);
    const actual = num(tx.balance);
    if (!Number.isFinite(actual)) continue;
    const expected = prevBal + num(tx.credit) - num(tx.debit);
    if (Math.abs(actual - expected) > 0.02) {
      balanceSequenceValid = false;
      if (balanceErrors.length < 12) {
        balanceErrors.push({
          index: i,
          date: tx.txDate,
          expected,
          actual,
          diff: actual - expected,
        });
      }
    }
  }

  return {
    totalDeposits,
    totalWithdrawals,
    stmtDeposits,
    stmtWithdrawals,
    depositsDiff,
    withdrawalsDiff,
    aggregatesMatch: depositsDiff < 0.02 && withdrawalsDiff < 0.02,
    balanceSequenceValid,
    balanceErrors,
    transactionCount: txs.length,
  };
}

export function buildCashFlowSeries(transactions: readonly BankTransactionLite[] = []): BankCashFlowPoint[] {
  const sorted = [...transactions].sort((a, b) => String(a.txDate).localeCompare(String(b.txDate)));
  let cumulative = 0;
  return sorted.map((tx) => {
    const net = num(tx.credit) - num(tx.debit);
    cumulative += net;
    return { date: tx.txDate, net, cumulative };
  });
}

type DailyAgg = { date: string; deposits: number; withdrawals: number; balance: number };

export function buildDailyChartData(transactions: readonly BankTransactionLite[] = []): BankDailyChartPoint[] {
  const byDate: Record<string, DailyAgg> = {};
  for (const tx of transactions) {
    const date = tx.txDate || '';
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { date, deposits: 0, withdrawals: 0, balance: 0 };
    byDate[date].deposits += num(tx.credit);
    byDate[date].withdrawals += num(tx.debit);
    if (num(tx.balance) > 0) byDate[date].balance = num(tx.balance);
  }
  return Object.values(byDate)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((day) => ({
      ...day,
      dateLabel: day.date.length >= 8 ? day.date.slice(5) : day.date,
      net: day.deposits - day.withdrawals,
    }));
}

export function extractPosTerminals(transactions: readonly BankTransactionLite[] = []): BankPosTerminalAgg[] {
  const terminals: Record<string, BankPosTerminalAgg> = {};
  const re = /Term\s*:?\s*(\d{8,16})/i;
  for (const tx of transactions) {
    const match = String(tx.description || '').match(re);
    if (match && num(tx.credit) > 0) {
      const id = match[1];
      if (!terminals[id]) terminals[id] = { terminalId: id, count: 0, total: 0 };
      terminals[id].count++;
      terminals[id].total += num(tx.credit);
    }
  }
  return Object.values(terminals).sort((a, b) => b.total - a.total);
}

export function buildDepositsByCategory(
  transactions: readonly BankTransactionLite[] = [],
  uncategorizedLabel = '-',
): BankDepositCategoryAgg[] {
  const map: Record<string, { count: number; total: number }> = {};
  for (const tx of transactions) {
    if (num(tx.credit) <= 0) continue;
    const name = tx.category?.nameAr || tx.category?.nameEn || uncategorizedLabel;
    if (!map[name]) map[name] = { count: 0, total: 0 };
    map[name].count++;
    map[name].total += num(tx.credit);
  }
  return Object.entries(map)
    .map(([name, row]) => ({ name, count: row.count, total: row.total }))
    .sort((a, b) => b.total - a.total);
}

export function topDebits(transactions: readonly BankTransactionLite[] = [], n = 8): BankTransactionLite[] {
  return [...transactions]
    .filter((tx) => num(tx.debit) > 0)
    .sort((a, b) => num(b.debit) - num(a.debit))
    .slice(0, n);
}

export function countPosLikeTransactions(transactions: readonly BankTransactionLite[] = []): number {
  const re = /mada|sadad|pos|visa|master|network|terminal/i;
  return transactions.filter((tx) => re.test(String(tx.description || ''))).length;
}

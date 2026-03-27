/**
 * ملخص الكشف + أجهزة POS — مطابقة منطق analyzeBankStatement (Base44)
 */

export type TxLike = {
  txDate: string;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
  categoryLabel: string;
};

export function extractTerminalId(description: string | null | undefined): string | null {
  if (!description) return null;
  const patterns = [
    /Term\s*(\d{10,16})/i,
    /terminal[:\s]*(\d{6,16})/i,
    /tid[:\s]*(\d{6,16})/i,
    /pos[:\s#]*(\d{6,16})/i,
    /\s(\d{10,16})$/,
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function buildPosTerminals(txs: TxLike[]): Array<{ terminal_id: string; count: number; total_amount: number }> {
  const map: Record<string, { terminal_id: string; count: number; total_amount: number }> = {};
  for (const tx of txs) {
    if (tx.credit <= 0) continue;
    const tid = extractTerminalId(tx.description);
    if (!tid) continue;
    if (!map[tid]) map[tid] = { terminal_id: tid, count: 0, total_amount: 0 };
    map[tid].count += 1;
    map[tid].total_amount += tx.credit;
  }
  return Object.values(map).sort((a, b) => b.total_amount - a.total_amount);
}

export function buildByCategory(txs: TxLike[]): Record<string, { count: number; total_debit: number; total_credit: number }> {
  const summary: Record<string, { count: number; total_debit: number; total_credit: number }> = {};
  for (const tx of txs) {
    const cat = tx.categoryLabel || 'غير مصنف';
    if (!summary[cat]) summary[cat] = { count: 0, total_debit: 0, total_credit: 0 };
    summary[cat].count += 1;
    summary[cat].total_debit += tx.debit;
    summary[cat].total_credit += tx.credit;
  }
  return summary;
}

/**
 * حساب الافتتاحي/الختامي مثل Base44 (ترتيب الملف تصاعدي/تنازلي)
 */
export function computeOpeningClosing(txs: TxLike[]): { openingBalance: number; closingBalance: number } {
  if (!txs.length) return { openingBalance: 0, closingBalance: 0 };

  const allDates = txs.map((t) => t.txDate).filter(Boolean);
  const uniqueDates = [...new Set(allDates)].sort();
  const oldestDate = uniqueDates[0];
  const newestDate = uniqueDates[uniqueDates.length - 1];

  const firstFileTx = txs[0];
  const lastFileTx = txs[txs.length - 1];
  const isDescending = (firstFileTx?.txDate || '') > (lastFileTx?.txDate || '');

  const oldestDateTxs = txs.filter((t) => t.txDate === oldestDate);
  const newestDateTxs = txs.filter((t) => t.txDate === newestDate);

  let chronologicalFirstTx: TxLike;
  let chronologicalLastTx: TxLike;

  if (isDescending) {
    chronologicalFirstTx = oldestDateTxs[oldestDateTxs.length - 1];
    chronologicalLastTx = newestDateTxs[0];
  } else {
    chronologicalFirstTx = oldestDateTxs[0];
    chronologicalLastTx = newestDateTxs[newestDateTxs.length - 1];
  }

  let openingBalance = 0;
  let closingBalance = 0;

  const lastBal = chronologicalLastTx?.balance;
  if (lastBal != null && lastBal > 0) {
    closingBalance = lastBal;
  }

  const firstBal = chronologicalFirstTx?.balance;
  if (firstBal != null && firstBal > 0) {
    openingBalance = firstBal - (chronologicalFirstTx.credit || 0) + (chronologicalFirstTx.debit || 0);
  }

  const totalDep = txs.reduce((s, t) => s + t.credit, 0);
  const totalWth = txs.reduce((s, t) => s + t.debit, 0);
  const verifiedClosing = openingBalance + totalDep - totalWth;
  const closingDiff = Math.abs(verifiedClosing - closingBalance);

  if (closingDiff > 10 && oldestDateTxs.length > 1) {
    const altFirstTx = isDescending ? oldestDateTxs[0] : oldestDateTxs[oldestDateTxs.length - 1];
    const altOpening = (altFirstTx.balance ?? 0) - (altFirstTx.credit || 0) + (altFirstTx.debit || 0);
    const altClosing = altOpening + totalDep - totalWth;
    const altDiff = Math.abs(altClosing - closingBalance);
    if (altDiff < closingDiff) {
      openingBalance = altOpening;
    }
  }

  return { openingBalance, closingBalance };
}

export function buildSummaryJsonPayload(txs: TxLike[], totalDeposits: number, totalWithdrawals: number) {
  const by_category = buildByCategory(txs);
  const pos_terminals = buildPosTerminals(txs);
  const { openingBalance, closingBalance } = computeOpeningClosing(txs);

  return {
    total_deposits: totalDeposits,
    total_withdrawals: totalWithdrawals,
    opening_balance: openingBalance,
    closing_balance: closingBalance,
    transaction_count: txs.length,
    by_category,
    pos_terminals,
  };
}

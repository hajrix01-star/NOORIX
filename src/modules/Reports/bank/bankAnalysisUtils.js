/**
 * أدواء مساعدة لتحليل كشوف الحساب — منطق محض بدون React
 */

export function num(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** مفتاح مستقر لعملية (للتحديد المتعدد) */
export function getTxKey(tx) {
  if (tx?.id) return tx.id;
  return `${tx?.txDate || ''}_${(tx?.description || '').slice(0, 40)}_${num(tx?.debit)}_${num(tx?.credit)}_${num(tx?.balance)}`;
}

export function buildSummaryByCategory(transactions, uncategorizedLabel) {
  const map = {};
  for (const tx of transactions || []) {
    const name =
      tx.category?.nameAr || tx.category?.nameEn || uncategorizedLabel || '—';
    if (!map[name]) {
      map[name] = { count: 0, totalDebit: 0, totalCredit: 0 };
    }
    map[name].count += 1;
    map[name].totalDebit += num(tx.debit);
    map[name].totalCredit += num(tx.credit);
  }
  return map;
}

/**
 * التحقق من تسلسل الأرصدة والمطابقة مع إجماليات الكشف المخزنة
 */
export function computeBalanceVerification(statement) {
  const txs = statement?.transactions || [];
  if (!txs.length) return null;

  const totalDeposits = txs.reduce((s, tx) => s + num(tx.credit), 0);
  const totalWithdrawals = txs.reduce((s, tx) => s + num(tx.debit), 0);

  const stmtDeposits = num(statement.totalDeposits);
  const stmtWithdrawals = num(statement.totalWithdrawals);

  const depositsDiff = Math.abs(totalDeposits - stmtDeposits);
  const withdrawalsDiff = Math.abs(totalWithdrawals - stmtWithdrawals);

  const first = txs[0];
  const last = txs[txs.length - 1];
  const descending = String(first?.txDate || '') > String(last?.txDate || '');
  const sorted = descending ? [...txs].reverse() : [...txs];

  let balanceSequenceValid = true;
  const balanceErrors = [];
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

/** سلسلة زمنية للتدفق النقدي التراكمي */
export function buildCashFlowSeries(transactions) {
  const sorted = [...(transactions || [])].sort((a, b) =>
    String(a.txDate).localeCompare(String(b.txDate)),
  );
  let cum = 0;
  return sorted.map((tx) => {
    cum += num(tx.credit) - num(tx.debit);
    return {
      date: tx.txDate,
      net: num(tx.credit) - num(tx.debit),
      cumulative: cum,
    };
  });
}

/** أكبر عمليات السحب (للتنبيهات) */
export function topDebits(transactions, n = 8) {
  return [...(transactions || [])]
    .filter((tx) => num(tx.debit) > 0)
    .sort((a, b) => num(b.debit) - num(a.debit))
    .slice(0, n);
}

/** عدد عمليات تحتوي كلمات نقاط البيع الشائعة */
export function countPosLikeTransactions(transactions) {
  const re = /مدى|mada|فوري|sadad|سداد|pos|نقاط|شبكة|visa|master/i;
  return (transactions || []).filter((tx) => re.test(String(tx.description || ''))).length;
}

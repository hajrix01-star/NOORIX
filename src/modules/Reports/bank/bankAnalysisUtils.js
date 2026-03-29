/**
 * أدوات مساعدة لتحليل كشوف الحساب — منطق محض بدون React
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

/**
 * قائمة التصنيفات الافتراضية — مستوردة من المشروع السابق
 * تُستخدم كـ fallback عند عدم وجود فئات مخصصة في قاعدة البيانات
 */
export const FALLBACK_CATEGORIES = [
  'إيرادات نقاط البيع',
  'مبيعات نقاط البيع',
  'تطبيقات توصيل',
  'تحويل',
  'تحويلات',
  'تحويل فوري',
  'رواتب',
  'إيجار',
  'كهرباء',
  'مياه',
  'فواتير سداد',
  'اتصالات',
  'رسوم بنكية',
  'سحب نقدي',
  'إيداع نقدي',
  'زكاة وضريبة',
  'ضرائب',
  'رسوم جوازات',
  'مخالفات مرورية',
  'رسوم بلدية',
  'تأمينات',
  'تأمينات اجتماعية',
  'موردين أغذية',
  'مشتريات',
  'مصروفات أخرى',
  'إيرادات أخرى',
  'رسوم حكومية',
  'عهدة مشتريات',
  'مخالفات',
  'قرضي',
  'غير مصنف',
];

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

/**
 * تجميع العمليات حسب التاريخ لرسم AreaChart (إيداعات + سحوبات يومياً)
 */
export function buildDailyChartData(transactions) {
  const byDate = {};
  for (const tx of transactions || []) {
    const date = tx.txDate || '';
    if (!date) continue;
    if (!byDate[date]) {
      byDate[date] = { date, deposits: 0, withdrawals: 0, balance: 0 };
    }
    byDate[date].deposits += num(tx.credit);
    byDate[date].withdrawals += num(tx.debit);
    if (num(tx.balance) > 0) byDate[date].balance = num(tx.balance);
  }
  return Object.values(byDate)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((d) => ({
      ...d,
      dateLabel: d.date.length >= 8 ? d.date.slice(5) : d.date,
      net: d.deposits - d.withdrawals,
    }));
}

/** استخراج أجهزة نقاط البيع من أوصاف العمليات */
export function extractPosTerminals(transactions) {
  const terminals = {};
  const re = /Term\s*:?\s*(\d{8,16})/i;
  for (const tx of transactions || []) {
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

/** تجميع الإيداعات حسب الفئة */
export function buildDepositsByCategory(transactions, uncategorizedLabel = '—') {
  const map = {};
  for (const tx of transactions || []) {
    if (num(tx.credit) <= 0) continue;
    const name = tx.category?.nameAr || tx.category?.nameEn || uncategorizedLabel;
    if (!map[name]) map[name] = { count: 0, total: 0 };
    map[name].count++;
    map[name].total += num(tx.credit);
  }
  return Object.entries(map)
    .map(([name, d]) => ({ name, count: d.count, total: d.total }))
    .sort((a, b) => b.total - a.total);
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

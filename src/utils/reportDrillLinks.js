/**
 * روابط من تقرير ربح/خسارة → شاشات التشغيل (فواتير / مبيعات) بمعاملات URL.
 */

export function monthDateBounds(year, month) {
  const y = Number(year);
  if (month != null && month >= 1 && month <= 12) {
    const m = Number(month);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    return { from, to };
  }
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/**
 * @returns {{ path: string, query: Record<string, string> } | null}
 */
export function buildReportDrillLink({ year, month, groupKey, itemKey }) {
  const { from, to } = monthDateBounds(year, month);
  const invBase = { from, to };

  if (groupKey === 'grossProfit' || groupKey === 'netProfit') return null;

  if (itemKey?.startsWith('account:')) return null;

  if (groupKey === 'sales') {
    return { path: '/sales', query: { from, to } };
  }

  if (groupKey === 'purchases') {
    if (!itemKey) return { path: '/invoices', query: { ...invBase, kind: 'purchase' } };
  }

  if (groupKey === 'expenses') {
    if (!itemKey) {
      return {
        path: '/invoices',
        query: { ...invBase, kind: 'expense,fixed_expense,hr_expense,salary,advance' },
      };
    }
  }

  if (!itemKey) {
    return { path: '/invoices', query: invBase };
  }

  if (itemKey.startsWith('kind:')) {
    const k = itemKey.slice('kind:'.length);
    if (k === 'sale') return { path: '/sales', query: { from, to } };
    return { path: '/invoices', query: { ...invBase, kind: k } };
  }

  if (itemKey.startsWith('category:')) {
    return { path: '/invoices', query: { ...invBase, categoryId: itemKey.slice('category:'.length) } };
  }

  if (itemKey.startsWith('expense-line:')) {
    return { path: '/invoices', query: { ...invBase, expenseLineId: itemKey.slice('expense-line:'.length) } };
  }

  if (itemKey.startsWith('sales-channel:')) {
    return { path: '/sales', query: { from, to } };
  }

  return { path: '/invoices', query: invBase };
}

export function drillToSearchParams(query) {
  const sp = new URLSearchParams();
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v != null && v !== '') sp.set(k, String(v));
  });
  return sp.toString();
}

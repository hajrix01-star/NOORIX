import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';

const zero = () => ({ net: '0', tax: '0', total: '0', count: 0 });

export type SumsByKindRow = { kind: string; count: number; net: string; tax: string; total: string };
export type InvoiceSumsRollup = {
  sums: { all: ReturnType<typeof zero>; inflow: ReturnType<typeof zero>; outflow: ReturnType<typeof zero> };
  sumsByKind: SumsByKindRow[];
};

type KindAggInput = {
  kind: string;
  _sum: { netAmount: Prisma.Decimal | null; taxAmount: Prisma.Decimal | null; totalAmount: Prisma.Decimal | null };
  _count: { _all: number };
};

function accumulateKindRows(rows: KindAggInput[]): { sums: InvoiceSumsRollup['sums']; sumsByKind: SumsByKindRow[] } {
  const sums = { all: zero(), inflow: zero(), outflow: zero() };
  const sumsByKind: SumsByKindRow[] = [];
  for (const row of rows) {
    const n = row._sum.netAmount?.toString() ?? '0';
    const x = row._sum.taxAmount?.toString() ?? '0';
    const t = row._sum.totalAmount?.toString() ?? '0';
    const c = row._count._all;
    sumsByKind.push({ kind: row.kind, count: c, net: n, tax: x, total: t });
    const target = row.kind === 'sale' ? sums.inflow : sums.outflow;
    target.net = new Decimal(target.net).plus(n).toString();
    target.tax = new Decimal(target.tax).plus(x).toString();
    target.total = new Decimal(target.total).plus(t).toString();
    target.count += c;
    sums.all.net = new Decimal(sums.all.net).plus(n).toString();
    sums.all.tax = new Decimal(sums.all.tax).plus(x).toString();
    sums.all.total = new Decimal(sums.all.total).plus(t).toString();
    sums.all.count += c;
  }
  return { sums, sumsByKind };
}

/** تجميع صفوف groupBy — ترتيب القائمة: `sale` أولاً ثم حسب المبلغ. */
export function rollupKindAggForInvoiceList(rows: KindAggInput[]): InvoiceSumsRollup {
  const { sums, sumsByKind } = accumulateKindRows(rows);
  sumsByKind.sort((a, b) => {
    if (a.kind === 'sale' && b.kind !== 'sale') return -1;
    if (b.kind === 'sale' && a.kind !== 'sale') return 1;
    return new Decimal(b.total).cmp(a.total) || a.kind.localeCompare(b.kind);
  });
  return { sums, sumsByKind };
}

/** تجميع لأغراض تقرير يوم واحد — ترتيب أبجدي حسب `kind`. */
export function rollupKindAggForDayClose(rows: KindAggInput[]): InvoiceSumsRollup {
  const { sums, sumsByKind } = accumulateKindRows(rows);
  sumsByKind.sort((a, b) => a.kind.localeCompare(b.kind));
  return { sums, sumsByKind };
}

/** ملخص المشتريات/المصاريف/الضريبة من صفوف `sumsByKind` (باستثناء `sale`). */
export function computeOutflowSummaryFromSumsByKind(sumsByKind: SumsByKindRow[]) {
  let purchasesTotal = new Decimal(0);
  let expensesTotal = new Decimal(0);
  let outflowTax = new Decimal(0);
  for (const r of sumsByKind) {
    if (r.kind === 'sale') continue;
    const tot = new Decimal(r.total);
    const tax = new Decimal(r.tax);
    outflowTax = outflowTax.plus(tax);
    if (r.kind === 'purchase') purchasesTotal = purchasesTotal.plus(tot);
    else expensesTotal = expensesTotal.plus(tot);
  }
  return {
    purchasesTotal: purchasesTotal.toString(),
    expensesTotal: expensesTotal.toString(),
    taxTotal: outflowTax.toString(),
  };
}

import Decimal from 'decimal.js';
import type { AnalyticsStudioAlertDto, PeriodAnalyticsBlock } from './analytics-studio.types';

export type { PeriodAnalyticsBlock } from './analytics-studio.types';

const OUTFLOW_KINDS = ['purchase', 'expense', 'fixed_expense', 'hr_expense', 'salary', 'advance'] as const;

export function sumKinds(block: PeriodAnalyticsBlock, kinds: readonly string[]): Decimal {
  let d = new Decimal(0);
  for (const k of kinds) {
    const row = block.totalsByKind[k];
    if (row?.totalAmount) d = d.plus(new Decimal(row.totalAmount));
  }
  return d;
}

export function pickSaleAmount(block: PeriodAnalyticsBlock): Decimal {
  const sale = block.totalsByKind['sale'];
  return sale?.totalAmount ? new Decimal(sale.totalAmount) : new Decimal(0);
}

export function purchaseAmount(block: PeriodAnalyticsBlock): Decimal {
  const p = block.totalsByKind['purchase'];
  return p?.totalAmount ? new Decimal(p.totalAmount) : new Decimal(0);
}

export function outflowAmount(block: PeriodAnalyticsBlock): Decimal {
  return sumKinds(block, OUTFLOW_KINDS as unknown as string[]);
}

export function totalInvoiceCount(block: PeriodAnalyticsBlock): number {
  let n = 0;
  for (const v of Object.values(block.totalsByKind)) {
    n += v.invoiceCount || 0;
  }
  return n;
}

function mergeTotalsByKind(
  acc: Record<string, { totalAmount: string; invoiceCount: number }>,
  src: PeriodAnalyticsBlock['totalsByKind'],
) {
  for (const [k, v] of Object.entries(src || {})) {
    if (!acc[k]) acc[k] = { totalAmount: '0', invoiceCount: 0 };
    acc[k].totalAmount = new Decimal(acc[k].totalAmount).plus(v.totalAmount || '0').toFixed(4);
    acc[k].invoiceCount += v.invoiceCount || 0;
  }
}

function mergeTopSuppliers(
  rows: Array<{ supplierId: string; nameAr: string; totalAmount: string; invoiceCount: number }>,
): typeof rows {
  const map = new Map<
    string,
    { supplierId: string; nameAr: string; totalAmount: Decimal; invoiceCount: number }
  >();
  for (const r of rows) {
    const prev = map.get(r.supplierId);
    if (!prev) {
      map.set(r.supplierId, {
        supplierId: r.supplierId,
        nameAr: r.nameAr || '—',
        totalAmount: new Decimal(r.totalAmount || '0'),
        invoiceCount: r.invoiceCount || 0,
      });
    } else {
      prev.totalAmount = prev.totalAmount.plus(r.totalAmount || '0');
      prev.invoiceCount += r.invoiceCount || 0;
      if (r.nameAr && r.nameAr !== '—') prev.nameAr = r.nameAr;
    }
  }
  return [...map.values()]
    .sort((a, b) => b.totalAmount.cmp(a.totalAmount))
    .slice(0, 5)
    .map((x) => ({
      supplierId: x.supplierId,
      nameAr: x.nameAr,
      totalAmount: x.totalAmount.toFixed(4),
      invoiceCount: x.invoiceCount,
    }));
}

function mergePurchaseCategories(rows: PeriodAnalyticsBlock['purchaseCategoryBreakdown']) {
  const key = (r: { nameAr: string; nameEn: string | null }) => `${r.nameAr}\u0000${r.nameEn ?? ''}`;
  const map = new Map<string, { nameAr: string; nameEn: string | null; amount: Decimal }>();
  for (const r of rows || []) {
    const k = key(r);
    const prev = map.get(k);
    const amt = new Decimal(r.amount || '0');
    if (!prev) map.set(k, { nameAr: r.nameAr, nameEn: r.nameEn ?? null, amount: amt });
    else prev.amount = prev.amount.plus(amt);
  }
  const merged = [...map.values()].sort((a, b) => b.amount.cmp(a.amount));
  const total = merged.reduce((s, x) => s.plus(x.amount), new Decimal(0));
  return {
    rows: merged.map((x) => ({
      categoryId: null as string | null,
      nameAr: x.nameAr,
      nameEn: x.nameEn,
      amount: x.amount.toFixed(4),
    })),
    purchaseCategoryTotal: total.toFixed(4),
  };
}

export function mergePeriodAnalyticsBlocks(blocks: PeriodAnalyticsBlock[]): PeriodAnalyticsBlock {
  if (blocks.length === 0) {
    return {
      startDate: '',
      endDate: '',
      totalsByKind: {},
      topSuppliers: [],
      supplierCategoryBreakdown: [],
      suppliersInPeriodCount: 0,
      purchaseCategoryBreakdown: [],
      purchaseCategoryTotal: '0',
    };
  }
  const totalsByKind: Record<string, { totalAmount: string; invoiceCount: number }> = {};
  let topSuppliersFlat: PeriodAnalyticsBlock['topSuppliers'] = [];
  let supplierCatMap = new Map<string | null, { categoryId: string | null; nameAr: string; nameEn: string | null; count: number }>();
  let purchaseCatRows: PeriodAnalyticsBlock['purchaseCategoryBreakdown'] = [];
  let suppliersInPeriodCount = 0;

  for (const b of blocks) {
    mergeTotalsByKind(totalsByKind, b.totalsByKind);
    topSuppliersFlat = topSuppliersFlat.concat(b.topSuppliers);
    suppliersInPeriodCount += b.suppliersInPeriodCount || 0;
    purchaseCatRows = purchaseCatRows.concat(b.purchaseCategoryBreakdown || []);
    for (const row of b.supplierCategoryBreakdown || []) {
      const cid = row.categoryId;
      const prev = supplierCatMap.get(cid);
      if (!prev) supplierCatMap.set(cid, { ...row });
      else prev.count += row.count;
    }
  }

  const supplierCategoryBreakdown = [...supplierCatMap.values()].sort((a, b) => b.count - a.count);
  const { rows: purchaseCategoryBreakdown, purchaseCategoryTotal } = mergePurchaseCategories(purchaseCatRows);

  return {
    startDate: blocks[0].startDate,
    endDate: blocks[0].endDate,
    totalsByKind,
    topSuppliers: mergeTopSuppliers(topSuppliersFlat),
    supplierCategoryBreakdown,
    suppliersInPeriodCount,
    purchaseCategoryBreakdown,
    purchaseCategoryTotal,
  };
}

export function buildInvoiceFlowKpis(merged: PeriodAnalyticsBlock) {
  const sales = pickSaleAmount(merged);
  const purchases = purchaseAmount(merged);
  const outflow = outflowAmount(merged);
  const totalInvoices = totalInvoiceCount(merged);
  const netInvoiceFlow = sales.minus(outflow);
  return {
    totalSales: sales.toFixed(4),
    totalPurchases: purchases.toFixed(4),
    totalOutflow: outflow.toFixed(4),
    totalInvoices,
    netInvoiceFlow: netInvoiceFlow.toFixed(4),
    /** مصدر الأرقام: تجميع واجهة الفوترة النشطة للفترة (ليست صافي ربح محاسبي). */
    sourceKey: 'reports.period_analytics.invoices',
  };
}

export function buildAlerts(
  merged: PeriodAnalyticsBlock,
  companyCount: number,
): AnalyticsStudioAlertDto[] {
  const alerts: AnalyticsStudioAlertDto[] = [];
  const sales = pickSaleAmount(merged);
  const purchases = purchaseAmount(merged);
  if (sales.gt(0)) {
    const ratio = purchases.div(sales);
    if (ratio.gt(0.85)) {
      alerts.push({
        id: 'purchase-to-sales-high',
        severity: 'warning',
        messageAr: 'المشتريات تتجاوز 85٪ من المبيعات المسجلة كفواتير في الفترة.',
        messageEn: 'Purchases exceed 85% of invoice-recorded sales for the period.',
        sourceKey: 'analytics-studio.heuristic.ratio',
      });
    }
  }
  if (totalInvoiceCount(merged) < 3 && merged.startDate) {
    alerts.push({
      id: 'low-activity',
      severity: 'info',
      messageAr: 'عدد قليل من الفواتير النشطة في هذه الفترة؛ قد لا تعكس النشاط الكامل.',
      messageEn: 'Few active invoices in this window; may not reflect full activity.',
      sourceKey: 'analytics-studio.heuristic.count',
    });
  }
  if (companyCount > 1) {
    alerts.push({
      id: 'multi-company-scope',
      severity: 'info',
      messageAr: `تم تجميع بيانات ${companyCount} شركة وفق صلاحياتك.`,
      messageEn: `Aggregated across ${companyCount} companies per your access.`,
      sourceKey: 'analytics-studio.scope',
    });
  }
  return alerts;
}

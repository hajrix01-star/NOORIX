import Decimal from 'decimal.js';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches, thisMonthToDateRange } from './utils';

function canSales(can: (p: string) => boolean) {
  return can(PERMISSIONS.VIEW_SALES) || can(PERMISSIONS.SALES_READ);
}
function canPurchases(can: (p: string) => boolean) {
  return can(PERMISSIONS.VIEW_INVOICES);
}
function canExpenses(can: (p: string) => boolean) {
  return can(PERMISSIONS.VIEW_VAULTS);
}

async function sumRevenue(ctx: ChatHandlerContext, start: Date, end: Date): Promise<Decimal> {
  const agg = await ctx.prisma.ledgerEntry.aggregate({
    where: {
      companyId: ctx.companyId,
      status: 'active',
      transactionDate: { gte: start, lte: end },
      creditAccount: { type: 'revenue' },
    },
    _sum: { amount: true },
  });
  return new Decimal(agg._sum.amount ?? 0);
}

async function sumPurchases(ctx: ChatHandlerContext, start: Date, end: Date): Promise<Decimal> {
  const agg = await ctx.prisma.ledgerEntry.aggregate({
    where: {
      companyId: ctx.companyId,
      status: 'active',
      transactionDate: { gte: start, lte: end },
      debitAccount: { code: { startsWith: 'PUR' } },
    },
    _sum: { amount: true },
  });
  return new Decimal(agg._sum.amount ?? 0);
}

async function sumOperatingExpenses(ctx: ChatHandlerContext, start: Date, end: Date): Promise<Decimal> {
  const agg = await ctx.prisma.ledgerEntry.aggregate({
    where: {
      companyId: ctx.companyId,
      status: 'active',
      transactionDate: { gte: start, lte: end },
      debitAccount: { type: 'expense', code: { not: { startsWith: 'PUR' } } },
    },
    _sum: { amount: true },
  });
  return new Decimal(agg._sum.amount ?? 0);
}

function pctOf(numer: Decimal, denom: Decimal): string {
  if (denom.lte(0)) return '—';
  return `${numer.div(denom).mul(100).toDecimalPlaces(2).toString()}%`;
}

/** نسبة رقمية 0–100 للواجهة (شريط مكدّس) */
function pctOfSalesNumber(numer: Decimal, sales: Decimal): number {
  if (sales.lte(0)) return 0;
  return Math.min(100, Number(numer.div(sales).mul(100).toDecimalPlaces(2)));
}

function fmtMoney(n: Decimal): string {
  return `${Number(n.toFixed(2)).toLocaleString('en')} SR`;
}

export const financeRatiosHandler: ChatHandler = {
  priority: 7,
  intent: 'finance_ratios',
  matchesIntent: (intent, can) => intent === 'finance_ratios' && canSales(can),
  canHandle: (q, can) => {
    if (!canSales(can)) return false;
    const askRatiosBundleShort =
      matches(q, [
        'نسب الخارج على المبيعات',
        'نسب الطلب على المبيعات',
        'النسب التشغيلية من المبيعات',
        'نسب المشتريات والمصروفات والمبيعات',
        'mtd operating ratios',
        'operating ratios vs sales',
      ]);
    const askPurVsSales =
      matches(q, ['نسبة المشتريات من المبيعات', 'نسبة مشتريات من مبيعات']) ||
      matches(q, ['purchases as % of sales', 'purchases as a percentage of sales']);
    const askExpVsSales =
      matches(q, ['نسبة المصروفات من المبيعات', 'نسبة مصروفات من مبيعات']) ||
      matches(q, ['expenses as % of sales', 'expenses as a percentage of sales']);
    const askPurPlusExpVsSales =
      matches(q, [
        'نسبة المشتريات والمصروفات من المبيعات',
        'نسبة مشتريات ومصروفات من المبيعات',
        'مجموع المشتريات والمصروفات من المبيعات',
      ]) || matches(q, ['purchases plus expenses', 'purchases and expenses as a share of sales']);
    return askRatiosBundleShort || askPurVsSales || askExpVsSales || askPurPlusExpVsSales;
  },
  process: async (ctx) => {
    const { can, query } = ctx;
    if (!canSales(can)) return null;

    const q = query.toLowerCase();
    const askPurVsSales =
      matches(q, ['نسبة المشتريات من المبيعات', 'نسبة مشتريات من مبيعات']) ||
      matches(q, ['purchases as % of sales', 'purchases as a percentage of sales']);
    const askExpVsSales =
      matches(q, ['نسبة المصروفات من المبيعات', 'نسبة مصروفات من مبيعات']) ||
      matches(q, ['expenses as % of sales', 'expenses as a percentage of sales']);
    const askPurPlusExpVsSales =
      matches(q, [
        'نسبة المشتريات والمصروفات من المبيعات',
        'نسبة مشتريات ومصروفات من المبيعات',
        'مجموع المشتريات والمصروفات من المبيعات',
      ]) || matches(q, ['purchases plus expenses', 'purchases and expenses as a share of sales']);

    const askRatiosBundleShort =
      matches(q, [
        'نسب الخارج على المبيعات',
        'نسب الطلب على المبيعات',
        'النسب التشغيلية من المبيعات',
        'نسب المشتريات والمصروفات والمبيعات',
        'mtd operating ratios',
        'operating ratios vs sales',
      ]);

    const compoundPreset =
      askRatiosBundleShort || (askPurVsSales && askExpVsSales && askPurPlusExpVsSales);

    const showPur = canPurchases(can) && (askPurVsSales || compoundPreset);
    const showExp = canExpenses(can) && (askExpVsSales || compoundPreset);
    const showSum =
      canPurchases(can) &&
      canExpenses(can) &&
      (askPurPlusExpVsSales || compoundPreset);

    if (!showPur && !showExp && !showSum) {
      return {
        answerAr:
          '## مؤشرات الخارج على المبيعات\n• الخلاصة: يلزم منحك صلاحية الفواتير (مشتريات) و/أو الخزائن (مصروفات) لعرض النسب.\nلحساب النسب يلزم صلاحية عرض الفواتير (مشتريات) و/أو الخزائن (مصروفات) حسب السؤال.',
        answerEn:
          '## Operating load vs sales\n• Summary: invoice and/or vault permissions are required to show these ratios.\nNeed invoice and/or vault permissions for the requested ratios.',
      };
    }

    const period = ctx.period ?? thisMonthToDateRange(ctx.now);
    const { start, end, labelAr, labelEn } = period;

    if (end.getTime() < start.getTime()) {
      return {
        answerAr: `## مؤشرات الخارج على المبيعات\nالفترة: ${labelAr}\n• الخلاصة: لا يمكن احتساب «حتى أمس» في أول يوم من الشهر — أعد السؤال غداً أو اختر فترة «الشهر الماضي» للمقارنة.\nلا يوجد يوم مكتمل بعد في الشهر الحالي (مثلاً اليوم أول يوم في الشهر) — لا يمكن حساب «من 1 حتى أمس» بعد.`,
        answerEn: `## Operating load vs sales\nPeriod: ${labelEn}\n• Summary: month-to-date through yesterday is not available on the first day of the month — try again tomorrow or pick “last month”.\nNo completed calendar day in the current month yet — cannot compute month-to-date through yesterday.`,
      };
    }

    const sales = await sumRevenue(ctx, start, end);
    const purchases = canPurchases(can) ? await sumPurchases(ctx, start, end) : new Decimal(0);
    const expenses = canExpenses(can) ? await sumOperatingExpenses(ctx, start, end) : new Decimal(0);

    const linesAr: string[] = [];
    const linesEn: string[] = [];
    linesAr.push('## مؤشرات الخارج على المبيعات');
    linesEn.push('## Operating load vs sales');
    linesAr.push(`الفترة: ${labelAr}`);
    linesEn.push(`Period: ${labelEn}`);

    if (sales.lte(0)) {
      linesAr.push(
        '• الخلاصة: لا مبيعات في هذه الفترة؛ راجع تسجيل الإيراد أو وسّع المدى الزمني ثم أعد السؤال.',
      );
      linesEn.push(
        '• Summary: no sales in this range; check revenue postings or widen the period, then ask again.',
      );
      return { answerAr: linesAr.join('\n'), answerEn: linesEn.join('\n') };
    }

    const sumPe = purchases.plus(expenses);
    let summaryAr = '';
    let summaryEn = '';
    if (showSum) {
      summaryAr = `• الخلاصة: إيراد الفترة ${fmtMoney(sales)}؛ الخارج التشغيلي (مشتريات + مصروفات) ${pctOf(sumPe, sales)} من ذلك الإيراد — التفاصيل أدناه.`;
      summaryEn = `• Summary: revenue ${fmtMoney(sales).replace('SR', 'SAR')}; operating load (purchases + expenses) is ${pctOf(sumPe, sales)} of that — see details below.`;
    } else if (showPur && showExp) {
      summaryAr = `• الخلاصة: مبيعات ${fmtMoney(sales)}؛ المشتريات ${pctOf(purchases, sales)} والمصروفات ${pctOf(expenses, sales)} من الإيراد — التفاصيل أدناه.`;
      summaryEn = `• Summary: sales ${fmtMoney(sales).replace('SR', 'SAR')}; purchases ${pctOf(purchases, sales)} and expenses ${pctOf(expenses, sales)} of revenue — details below.`;
    } else if (showPur) {
      summaryAr = `• الخلاصة: مبيعات ${fmtMoney(sales)}؛ المشتريات تمثل ${pctOf(purchases, sales)} من الإيراد في هذه الفترة.`;
      summaryEn = `• Summary: sales ${fmtMoney(sales).replace('SR', 'SAR')}; purchases are ${pctOf(purchases, sales)} of revenue for this range.`;
    } else if (showExp) {
      summaryAr = `• الخلاصة: مبيعات ${fmtMoney(sales)}؛ المصروفات تمثل ${pctOf(expenses, sales)} من الإيراد في هذه الفترة.`;
      summaryEn = `• Summary: sales ${fmtMoney(sales).replace('SR', 'SAR')}; expenses are ${pctOf(expenses, sales)} of revenue for this range.`;
    } else {
      summaryAr = `• الخلاصة: مبيعات الفترة ${fmtMoney(sales)} — راجع التفاصيل أدناه.`;
      summaryEn = `• Summary: revenue for this range is ${fmtMoney(sales).replace('SR', 'SAR')} — see below.`;
    }
    linesAr.push(summaryAr);
    linesEn.push(summaryEn);

    linesAr.push(`• إجمالي المبيعات: ${fmtMoney(sales)}`);
    linesEn.push(`• Total sales: ${fmtMoney(sales).replace('SR', 'SAR')}`);

    if (showPur) {
      linesAr.push(`• نسبة المشتريات من المبيعات: ${pctOf(purchases, sales)} (مشتريات: ${fmtMoney(purchases)})`);
      linesEn.push(`• Purchases / sales: ${pctOf(purchases, sales)} (purchases: ${fmtMoney(purchases).replace('SR', 'SAR')})`);
    }
    if (showExp) {
      linesAr.push(`• نسبة المصروفات من المبيعات: ${pctOf(expenses, sales)} (مصروفات: ${fmtMoney(expenses)})`);
      linesEn.push(`• Expenses / sales: ${pctOf(expenses, sales)} (expenses: ${fmtMoney(expenses).replace('SR', 'SAR')})`);
    }
    if (showSum) {
      const sum = purchases.plus(expenses);
      linesAr.push(`• نسبة (المشتريات + المصروفات) من المبيعات: ${pctOf(sum, sales)} (المجموع: ${fmtMoney(sum)})`);
      linesEn.push(`• (Purchases + expenses) / sales: ${pctOf(sum, sales)} (sum: ${fmtMoney(sum).replace('SR', 'SAR')})`);
    }

    const ratioSegments: Array<{ key: 'purchases' | 'expenses'; pct: number }> = [];
    if (showPur) ratioSegments.push({ key: 'purchases', pct: pctOfSalesNumber(purchases, sales) });
    if (showExp) ratioSegments.push({ key: 'expenses', pct: pctOfSalesNumber(expenses, sales) });
    let normalized = ratioSegments;
    const segSum = ratioSegments.reduce((a, s) => a + s.pct, 0);
    if (segSum > 100 && ratioSegments.length > 0) {
      normalized = ratioSegments.map((s) => ({
        ...s,
        pct: Number(((s.pct / segSum) * 100).toFixed(2)),
      }));
    }

    return {
      answerAr: linesAr.join('\n'),
      answerEn: linesEn.join('\n'),
      ...(normalized.length > 0
        ? {
            extras: {
              chart: { kind: 'financeRatios' as const, segments: normalized },
            },
          }
        : {}),
    };
  },
};

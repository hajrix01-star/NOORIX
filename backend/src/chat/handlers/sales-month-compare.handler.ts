import Decimal from 'decimal.js';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches, lastMonthPartialMatchingMtd, thisMonthThroughTodayRange } from './utils';

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

function fmtMoney(n: Decimal): string {
  return `${Number(n.toFixed(2)).toLocaleString('en')} SR`;
}

export const salesMonthCompareHandler: ChatHandler = {
  priority: 6,
  intent: 'sales_month_compare',
  matchesIntent: (intent, can) =>
    intent === 'sales_month_compare' &&
    (can(PERMISSIONS.VIEW_SALES) || can(PERMISSIONS.SALES_READ)),
  canHandle: (q, can) => {
    if (!can(PERMISSIONS.VIEW_SALES) && !can(PERMISSIONS.SALES_READ)) return false;
    const cmp = matches(q, [
      'قارن',
      'قارنة',
      'compare',
      'comparison',
      'مقارنة',
      'مقابل',
      'versus',
      ' vs ',
    ]);
    const salesWord = matches(q, ['مبيعات', 'sales', 'revenue']);
    const hasLast = matches(q, [
      'الشهر الماضي',
      'شهر ماضي',
      'آخر شهر',
      'last month',
      'previous month',
      'الماضي',
    ]);
    const hasThis = matches(q, [
      'الحالي',
      'الشهر الحالي',
      'هذا الشهر',
      'this month',
      'current month',
      'الشهر الحال',
    ]);
    return cmp && salesWord && hasLast && hasThis;
  },
  process: async (ctx) => {
    const { can, now } = ctx;
    if (!can(PERMISSIONS.VIEW_SALES) && !can(PERMISSIONS.SALES_READ)) return null;

    const thisP = thisMonthThroughTodayRange(now);
    const prevP = lastMonthPartialMatchingMtd(now);

    const cur = await sumRevenue(ctx, thisP.start, thisP.end);
    const prev = await sumRevenue(ctx, prevP.start, prevP.end);
    const diff = cur.minus(prev);
    const deltaPct = prev.gt(0) ? diff.div(prev).mul(100).toDecimalPlaces(2).toString() : '—';
    const trendAr = prev.lte(0) ? '—' : diff.gt(0) ? 'أعلى من الشهر الماضي' : diff.lt(0) ? 'أقل من الشهر الماضي' : 'مساوٍ للشهر الماضي';
    const trendEn = prev.lte(0) ? '—' : diff.gt(0) ? 'Above last month' : diff.lt(0) ? 'Below last month' : 'Same as last month';

    const linesAr = [
      '## مقارنة المبيعات بين الشهرين',
      `• هذا الشهر (${thisP.labelAr}): ${fmtMoney(cur)}`,
      `• ${prevP.labelAr}: ${fmtMoney(prev)}`,
      `الفرق: ${fmtMoney(diff)} (${deltaPct}% عن الشهر الماضي)`,
      `الاتجاه: ${trendAr}`,
      'تعريف: مقارنة عادلة — الشهر الحالي من 1 إلى اليوم؛ الشهر الماضي من 1 إلى نفس رقم اليوم (مقصور على طول ذلك الشهر).',
    ];
    const linesEn = [
      '## Month-over-month sales',
      `• This month (${thisP.labelEn}): ${fmtMoney(cur).replace('SR', 'SAR')}`,
      `• ${prevP.labelEn}: ${fmtMoney(prev).replace('SR', 'SAR')}`,
      `Difference: ${fmtMoney(diff).replace('SR', 'SAR')} (${deltaPct}% vs last month)`,
      `Trend: ${trendEn}`,
      'Definition: this month from the 1st through today; last month from the 1st through the same calendar day (capped by last month length).',
    ];

    return { answerAr: linesAr.join('\n'), answerEn: linesEn.join('\n') };
  },
};

import Decimal from 'decimal.js';
import { formatReportMoneyInteger, formatReportPercentNumber } from '../../common/utils/report-display-format.util';
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
  return `${formatReportMoneyInteger(n)} SR`;
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
    const deltaPct = prev.gt(0) ? formatReportPercentNumber(diff.div(prev).mul(100)) : '—';
    const trendAr = prev.lte(0) ? '—' : diff.gt(0) ? 'أعلى' : diff.lt(0) ? 'أدنى' : 'مماثل';
    const trendEn = prev.lte(0) ? '—' : diff.gt(0) ? 'Up' : diff.lt(0) ? 'Down' : 'Flat';

    /** سطر واحد فقط عند غياب بيانات الشهر الماضي — دون صندوق «خلاصة» المزعج */
    const hintAr = prev.lte(0) ? '• الشهر الماضي: لا بيانات في نافذة المقارنة.' : '';
    const hintEn = prev.lte(0) ? '• Last month: no data in this comparison window.' : '';

    const diffLabelAr = prev.gt(0) ? `${fmtMoney(diff)} (${deltaPct}%)` : `${fmtMoney(diff)}`;
    const diffLabelEn = prev.gt(0) ? `${fmtMoney(diff).replace('SR', 'SAR')} (${deltaPct}%)` : `${fmtMoney(diff).replace('SR', 'SAR')}`;

    const linesAr = ['## مبيعات: هذا الشهر مقابل الماضي'];
    if (hintAr) linesAr.push(hintAr);
    linesAr.push(
      'الفترة\tالمبيعات',
      `هذا الشهر\t${fmtMoney(cur)}`,
      `الشهر الماضي\t${fmtMoney(prev)}`,
      `الفرق\t${diffLabelAr}`,
      `الاتجاه\t${trendAr}`,
    );
    const linesEn = ['## Sales: this month vs last'];
    if (hintEn) linesEn.push(hintEn);
    linesEn.push(
      'Period\tSales',
      `This month\t${fmtMoney(cur).replace('SR', 'SAR')}`,
      `Last month\t${fmtMoney(prev).replace('SR', 'SAR')}`,
      `Change\t${diffLabelEn}`,
      `Trend\t${trendEn}`,
    );

    return {
      answerAr: linesAr.join('\n'),
      answerEn: linesEn.join('\n'),
      extras: {
        chart: {
          kind: 'monthCompare',
          bars: [
            { key: 'prev', labelAr: 'الماضي', labelEn: 'Last', value: prev.toNumber() },
            { key: 'cur', labelAr: 'الحالي', labelEn: 'This', value: cur.toNumber() },
          ],
        },
      },
    };
  },
};

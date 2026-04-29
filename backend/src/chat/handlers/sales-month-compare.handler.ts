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
    const trendAr = prev.lte(0) ? '—' : diff.gt(0) ? 'أعلى من الشهر الماضي' : diff.lt(0) ? 'أقل من الشهر الماضي' : 'مساوٍ للشهر الماضي';
    const trendEn = prev.lte(0) ? '—' : diff.gt(0) ? 'Above last month' : diff.lt(0) ? 'Below last month' : 'Same as last month';

    let summaryAr = '';
    let summaryEn = '';
    if (prev.lte(0)) {
      summaryAr =
        '• الخلاصة: لا بيانات مبيعات كافية في الشهر الماضي لهذه الفترة — راجع تسجيل الإيراد أو اختر شهراً أحدث للمقارنة.';
      summaryEn =
        '• Summary: not enough last-month revenue in this window — check postings or pick another month to compare.';
    } else if (diff.gt(0)) {
      summaryAr = `• الخلاصة: مبيعاتك هذا الشهر أعلى من الشهر الماضي بنحو ${deltaPct}% لنفس الفترة — جيد إن كان ذلك متوافقاً مع أهدافك.`;
      summaryEn = `• Summary: this month is about ${deltaPct}% above last month for the same window — good if that matches your plan.`;
    } else if (diff.lt(0)) {
      const dropPct = formatReportPercentNumber(diff.abs().div(prev).mul(100));
      summaryAr = `• الخلاصة: مبيعاتك هذا الشهر أدنى من الشهر الماضي بنحو ${dropPct}% لنفس الفترة — راجع الأسباب التشغيلية إن لزم.`;
      summaryEn = `• Summary: this month is about ${dropPct}% below last month for the same window — review drivers if needed.`;
    } else {
      summaryAr = '• الخلاصة: مبيعات الشهرين متقاربة لنفس الفترة — استقرار نسبي.';
      summaryEn = '• Summary: both months are close for the same window — relatively steady.';
    }

    const linesAr = [
      '## مقارنة المبيعات بين الشهرين',
      summaryAr,
      '',
      'الشهر\tالمبيعات',
      `الحالي (${thisP.labelAr})\t${fmtMoney(cur)}`,
      `${prevP.labelAr}\t${fmtMoney(prev)}`,
      `الفرق\t${fmtMoney(diff)} (${deltaPct}% عن الشهر الماضي)`,
      `الاتجاه\t${trendAr}`,
      '• نطاق المقارنة: الشهر الحالي من اليوم 1 حتى اليوم؛ الشهر الماضي من اليوم 1 حتى نفس تاريخ اليوم (بحد أقصى أيام ذلك الشهر).',
    ];
    const linesEn = [
      '## Month-over-month sales',
      summaryEn,
      '',
      'Month\tSales',
      `Current (${thisP.labelEn})\t${fmtMoney(cur).replace('SR', 'SAR')}`,
      `${prevP.labelEn}\t${fmtMoney(prev).replace('SR', 'SAR')}`,
      `Difference\t${fmtMoney(diff).replace('SR', 'SAR')} (${deltaPct}% vs last month)`,
      `Trend\t${trendEn}`,
      '• Comparison window: this month from the 1st through today; last month from the 1st through the same calendar day (capped by that month’s length).',
    ];

    return {
      answerAr: linesAr.join('\n'),
      answerEn: linesEn.join('\n'),
      extras: {
        chart: {
          kind: 'monthCompare',
          bars: [
            { key: 'prev', labelAr: 'الشهر الماضي', labelEn: 'Last month', value: prev.toNumber() },
            { key: 'cur', labelAr: 'الشهر الحالي', labelEn: 'This month', value: cur.toNumber() },
          ],
        },
      },
    };
  },
};

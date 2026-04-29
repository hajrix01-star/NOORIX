import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';

export const invoicesHandler: ChatHandler = {
  priority: 20,
  intent: 'invoices',
  matchesIntent: (intent, can) => intent === 'invoices' && can(PERMISSIONS.INVOICES_READ),
  canHandle: (q, can) =>
    matches(q, [
      'فواتير', 'فاتورة', 'عدد الفواتير', 'invoice', 'آخر فاتورة', 'last invoice',
      'فواتير معلقة', 'فواتير مبيعات', 'فواتير مشتريات',
    ]) && can(PERMISSIONS.INVOICES_READ),
  process: async (ctx) => {
    const { companyId, year } = ctx;
    const { prisma } = ctx;
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    // آخر فاتورة
    if (matches(ctx.query, ['آخر فاتورة', 'last invoice', 'اخر فاتورة'])) {
      const last = await prisma.invoice.findFirst({
        where: { companyId, status: 'active' },
        orderBy: { transactionDate: 'desc' },
        include: { supplier: { select: { nameAr: true, nameEn: true } } },
      });
      if (!last) {
        return { answerAr: 'لا توجد فواتير.', answerEn: 'No invoices found.' };
      }
      const supp = last.supplier ? ` (${last.supplier.nameAr})` : '';
      const suppEn = last.supplier ? ` (${last.supplier.nameEn || last.supplier.nameAr})` : '';
      return {
        answerAr: [
          '## آخر فاتورة',
          '',
          'الحقل\tالقيمة',
          `الرقم\t${last.invoiceNumber}${supp}`,
          `المبلغ\t${Number(last.totalAmount).toLocaleString('en')} SR`,
          `التاريخ\t${last.transactionDate.toLocaleDateString('en-GB')}`,
        ].join('\n'),
        answerEn: [
          '## Last invoice',
          '',
          'Field\tValue',
          `Number\t${last.invoiceNumber}${suppEn}`,
          `Amount\t${Number(last.totalAmount).toLocaleString('en')} SAR`,
          `Date\t${last.transactionDate.toLocaleDateString('en-GB')}`,
        ].join('\n'),
      };
    }

    // عدد الفواتير
    const [saleCount, purchaseCount, expenseCount] = await Promise.all([
      prisma.invoice.count({ where: { companyId, kind: 'sale', status: 'active', transactionDate: { gte: start, lte: end } } }),
      prisma.invoice.count({ where: { companyId, kind: 'purchase', status: 'active', transactionDate: { gte: start, lte: end } } }),
      prisma.invoice.count({ where: { companyId, kind: { in: ['expense', 'fixed_expense', 'hr_expense', 'salary', 'advance'] }, status: 'active', transactionDate: { gte: start, lte: end } } }),
    ]);
    const total = saleCount + purchaseCount + expenseCount;
    return {
      answerAr: [
        `## عدد الفواتير — ${year}`,
        '',
        'النوع\tالعدد',
        `مبيعات\t${saleCount}`,
        `مشتريات\t${purchaseCount}`,
        `مصروفات\t${expenseCount}`,
        `الإجمالي\t${total}`,
      ].join('\n'),
      answerEn: [
        `## Invoice counts — ${year}`,
        '',
        'Kind\tCount',
        `Sales\t${saleCount}`,
        `Purchases\t${purchaseCount}`,
        `Expenses\t${expenseCount}`,
        `Total\t${total}`,
      ].join('\n'),
    };
  },
};

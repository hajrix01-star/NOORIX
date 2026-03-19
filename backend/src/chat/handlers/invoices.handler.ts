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
      return {
        answerAr: `آخر فاتورة: ${last.invoiceNumber}${supp} — ${Number(last.totalAmount).toLocaleString('en')} ﷼ — ${last.transactionDate.toLocaleDateString('en-GB')}`,
        answerEn: `Last invoice: ${last.invoiceNumber}${last.supplier ? ` (${last.supplier.nameEn || last.supplier.nameAr})` : ''} — ${Number(last.totalAmount).toLocaleString('en')} SAR — ${last.transactionDate.toLocaleDateString('en-GB')}`,
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
      answerAr: `عدد الفواتير في ${year}: ${total}\n• مبيعات: ${saleCount}\n• مشتريات: ${purchaseCount}\n• مصروفات: ${expenseCount}`,
      answerEn: `Invoice count for ${year}: ${total}\n• Sales: ${saleCount}\n• Purchases: ${purchaseCount}\n• Expenses: ${expenseCount}`,
    };
  },
};

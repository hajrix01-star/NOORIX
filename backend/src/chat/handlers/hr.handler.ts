import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';

export const hrHandler: ChatHandler = {
  priority: 30,
  intent: 'hr',
  matchesIntent: (intent, can) => intent === 'hr' && (can(PERMISSIONS.EMPLOYEES_READ) || can(PERMISSIONS.HR_READ)),
  canHandle: (q, can) =>
    matches(q, [
      'موظفين', 'موظف', 'عدد الموظفين', 'اسم الموظف', 'أسماء الموظفين', 'قائمة الموظفين', 'employee',
      'رواتب', 'مسيرات', 'مسيرة', 'payroll', 'salary', 'إجازات', 'إجازة', 'leave',
      'إقامات', 'إقامة', 'residency', 'آخر مسيرة', 'last payroll',
      'سلفيات', 'سلفية', 'سلف', 'advance', 'advances',
      'خصومات', 'خصم', 'deduction', 'deductions', 'جزاء', 'penalty',
    ]) && (can(PERMISSIONS.EMPLOYEES_READ) || can(PERMISSIONS.HR_READ)),
  process: async (ctx) => {
    const { companyId, year } = ctx;
    const { prisma } = ctx;
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);

    // أسماء الموظفين / قائمة الموظفين / اسم الموظف
    if (matches(ctx.query, ['اسم الموظف', 'أسماء الموظفين', 'أسماء الموظف', 'قائمة الموظفين', 'من هم الموظفين', 'employee names', 'list employees'])) {
      const employees = await prisma.employee.findMany({
        where: { companyId, status: 'active' },
        select: { name: true, nameEn: true, employeeSerial: true },
        orderBy: { name: 'asc' },
      });
      if (employees.length === 0) {
        return { answerAr: 'لا يوجد موظفين نشطين.', answerEn: 'No active employees.' };
      }
      const namesAr = employees.map((e: { name: string; nameEn: string | null; employeeSerial: string }) => `${e.name} (${e.employeeSerial})`).join('، ');
      const namesEn = employees.map((e: { name: string; nameEn: string | null; employeeSerial: string }) => `${e.nameEn || e.name} (${e.employeeSerial})`).join(', ');
      return {
        answerAr: `الموظفون النشطون: ${namesAr}`,
        answerEn: `Active employees: ${namesEn}`,
      };
    }

    // آخر مسيرة رواتب
    if (matches(ctx.query, ['آخر مسيرة', 'اخر مسيرة', 'last payroll', 'آخر راتب'])) {
      const last = await prisma.payrollRun.findFirst({
        where: { companyId },
        orderBy: { payrollMonth: 'desc' },
      });
      if (!last) {
        return { answerAr: 'لا توجد مسيرات رواتب.', answerEn: 'No payroll runs found.' };
      }
      return {
        answerAr: `آخر مسيرة: ${last.runNumber} — ${Number(last.totalAmount).toLocaleString('en')} ﷼ — ${last.employeeCount} موظف`,
        answerEn: `Last payroll: ${last.runNumber} — ${Number(last.totalAmount).toLocaleString('en')} SAR — ${last.employeeCount} employees`,
      };
    }

    // موظفين
    if (matches(ctx.query, ['موظفين', 'موظف', 'عدد الموظفين', 'employee'])) {
      const count = await prisma.employee.count({ where: { companyId, status: 'active' } });
      const terminated = await prisma.employee.count({ where: { companyId, status: 'terminated' } });
      return {
        answerAr: `عدد الموظفين النشطين: ${count}${terminated > 0 ? ` | المنتهية خدمتهم: ${terminated}` : ''}`,
        answerEn: `Active employees: ${count}${terminated > 0 ? ` | Terminated: ${terminated}` : ''}`,
      };
    }

    // رواتب
    if (matches(ctx.query, ['رواتب', 'مسيرات', 'مسيرة', 'payroll', 'salary'])) {
      const runs = await prisma.payrollRun.count({
        where: { companyId, payrollMonth: { gte: start, lte: end } },
      });
      return {
        answerAr: `عدد مسيرات الرواتب في ${year}: ${runs}`,
        answerEn: `Payroll runs in ${year}: ${runs}`,
      };
    }

    // إجازات
    if (matches(ctx.query, ['إجازات', 'إجازة', 'leave'])) {
      const count = await prisma.leave.count({ where: { companyId, startDate: { gte: start, lte: end } } });
      const pending = await prisma.leave.count({ where: { companyId, status: 'pending', startDate: { gte: start, lte: end } } });
      return {
        answerAr: `عدد طلبات الإجازة في ${year}: ${count}${pending > 0 ? ` (معلقة: ${pending})` : ''}`,
        answerEn: `Leave requests in ${year}: ${count}${pending > 0 ? ` (pending: ${pending})` : ''}`,
      };
    }

    // سلفيات الموظفين (فواتير kind=advance)
    if (matches(ctx.query, ['سلفيات', 'سلفية', 'سلف', 'advance', 'advances'])) {
      const whereYear = {
        companyId,
        kind: 'advance',
        status: 'active',
        transactionDate: { gte: start, lte: end },
      };
      const count = await prisma.invoice.count({ where: whereYear });
      const open = await prisma.invoice.count({
        where: { ...whereYear, settledAt: null },
      });
      const sum = await prisma.invoice.aggregate({
        where: whereYear,
        _sum: { netAmount: true },
      });
      const total = Number(sum._sum.netAmount || 0);
      return {
        answerAr: `سلفيات الموظفين في ${year}: ${count} فاتورة${open > 0 ? ` (غير مسددة بالكامل: ${open})` : ''} — إجمالي المبالغ: ${total.toLocaleString('en')} ﷼`,
        answerEn: `Employee advances in ${year}: ${count} invoice(s)${open > 0 ? ` (not fully settled: ${open})` : ''} — total: ${total.toLocaleString('en')} SAR`,
      };
    }

    // خصومات الموظفين
    if (matches(ctx.query, ['خصومات', 'خصم', 'deduction', 'deductions', 'جزاء', 'penalty'])) {
      const count = await prisma.employeeDeduction.count({
        where: { companyId, transactionDate: { gte: start, lte: end } },
      });
      const sum = await prisma.employeeDeduction.aggregate({
        where: { companyId, transactionDate: { gte: start, lte: end } },
        _sum: { amount: true },
      });
      const total = Number(sum._sum.amount || 0);
      return {
        answerAr: `سجلات خصومات الموظفين في ${year}: ${count} — إجمالي المبالغ: ${total.toLocaleString('en')} ﷼`,
        answerEn: `Employee deduction records in ${year}: ${count} — total: ${total.toLocaleString('en')} SAR`,
      };
    }

    // إقامات
    if (matches(ctx.query, ['إقامات', 'إقامة', 'residency'])) {
      const count = await prisma.employeeResidency.count({ where: { companyId } });
      const expired = await prisma.employeeResidency.count({ where: { companyId, status: 'expired' } });
      return {
        answerAr: `عدد الإقامات المسجلة: ${count}${expired > 0 ? ` (منتهية: ${expired})` : ''}`,
        answerEn: `Registered residencies: ${count}${expired > 0 ? ` (expired: ${expired})` : ''}`,
      };
    }

    return null;
  },
};

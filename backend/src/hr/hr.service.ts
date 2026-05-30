/**
 * HRService — واجهة نحو HrPayroll / HrLeave / HrResidency / HrDocument (بدون تغيير مسارات الـ API).
 */
import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { HrPayrollService } from './hr-payroll.service';
import { HrLeaveService } from './hr-leave.service';
import { HrResidencyService } from './hr-residency.service';
import { HrDocumentService } from './hr-document.service';
import { sumMonthlyPayrollForActiveEmployees } from './utils/employee-monthly-payroll.util';

@Injectable()
export class HRService {
  constructor(
    private readonly payroll: HrPayrollService,
    private readonly leave: HrLeaveService,
    private readonly residency: HrResidencyService,
    private readonly document: HrDocumentService,
    private readonly prisma: TenantPrismaService,
  ) {}

  // ── Payroll & advances ──

  findPayrollRunItemsByEmployee(
    ...args: Parameters<HrPayrollService['findPayrollRunItemsByEmployee']>
  ) {
    return this.payroll.findPayrollRunItemsByEmployee(...args);
  }

  findPayrollRuns(...args: Parameters<HrPayrollService['findPayrollRuns']>) {
    return this.payroll.findPayrollRuns(...args);
  }

  findPayrollRunById(...args: Parameters<HrPayrollService['findPayrollRunById']>) {
    return this.payroll.findPayrollRunById(...args);
  }

  createPayrollRun(...args: Parameters<HrPayrollService['createPayrollRun']>) {
    return this.payroll.createPayrollRun(...args);
  }

  updatePayrollRunStatus(
    ...args: Parameters<HrPayrollService['updatePayrollRunStatus']>
  ) {
    return this.payroll.updatePayrollRunStatus(...args);
  }

  updatePayrollRun(...args: Parameters<HrPayrollService['updatePayrollRun']>) {
    return this.payroll.updatePayrollRun(...args);
  }

  deletePayrollRun(...args: Parameters<HrPayrollService['deletePayrollRun']>) {
    return this.payroll.deletePayrollRun(...args);
  }

  issuePayrollPayment(...args: Parameters<HrPayrollService['issuePayrollPayment']>) {
    return this.payroll.issuePayrollPayment(...args);
  }

  findAdvanceInvoices(...args: Parameters<HrPayrollService['findAdvanceInvoices']>) {
    return this.payroll.findAdvanceInvoices(...args);
  }

  // ── Movements, allowances, deductions (مع المسير في نفس خدمة الرواتب) ──

  findMovements(...args: Parameters<HrPayrollService['findMovements']>) {
    return this.payroll.findMovements(...args);
  }

  createMovement(...args: Parameters<HrPayrollService['createMovement']>) {
    return this.payroll.createMovement(...args);
  }

  findAllowances(...args: Parameters<HrPayrollService['findAllowances']>) {
    return this.payroll.findAllowances(...args);
  }

  createAllowance(...args: Parameters<HrPayrollService['createAllowance']>) {
    return this.payroll.createAllowance(...args);
  }

  deleteAllowance(...args: Parameters<HrPayrollService['deleteAllowance']>) {
    return this.payroll.deleteAllowance(...args);
  }

  findDeductions(...args: Parameters<HrPayrollService['findDeductions']>) {
    return this.payroll.findDeductions(...args);
  }

  createDeduction(...args: Parameters<HrPayrollService['createDeduction']>) {
    return this.payroll.createDeduction(...args);
  }

  // ── Leave ──

  findLeaves(...args: Parameters<HrLeaveService['findLeaves']>) {
    return this.leave.findLeaves(...args);
  }

  findLeaveSalarySettlements(
    ...args: Parameters<HrLeaveService['findLeaveSalarySettlements']>
  ) {
    return this.leave.findLeaveSalarySettlements(...args);
  }

  getLeaveSalarySettlementPreview(
    ...args: Parameters<HrLeaveService['getLeaveSalarySettlementPreview']>
  ) {
    return this.leave.getLeaveSalarySettlementPreview(...args);
  }

  issueLeaveSalarySettlement(
    ...args: Parameters<HrLeaveService['issueLeaveSalarySettlement']>
  ) {
    return this.leave.issueLeaveSalarySettlement(...args);
  }

  createLeave(...args: Parameters<HrLeaveService['createLeave']>) {
    return this.leave.createLeave(...args);
  }

  updateLeave(...args: Parameters<HrLeaveService['updateLeave']>) {
    return this.leave.updateLeave(...args);
  }

  updateLeaveStatus(...args: Parameters<HrLeaveService['updateLeaveStatus']>) {
    return this.leave.updateLeaveStatus(...args);
  }

  returnFromLeave(...args: Parameters<HrLeaveService['returnFromLeave']>) {
    return this.leave.returnFromLeave(...args);
  }

  deleteLeave(...args: Parameters<HrLeaveService['deleteLeave']>) {
    return this.leave.deleteLeave(...args);
  }

  // ── Residency ──

  findResidencies(...args: Parameters<HrResidencyService['findResidencies']>) {
    return this.residency.findResidencies(...args);
  }

  createResidency(...args: Parameters<HrResidencyService['createResidency']>) {
    return this.residency.createResidency(...args);
  }

  updateResidency(...args: Parameters<HrResidencyService['updateResidency']>) {
    return this.residency.updateResidency(...args);
  }

  deleteResidency(...args: Parameters<HrResidencyService['deleteResidency']>) {
    return this.residency.deleteResidency(...args);
  }

  issueResidencyInvoice(...args: Parameters<HrResidencyService['issueResidencyInvoice']>) {
    return this.residency.issueResidencyInvoice(...args);
  }

  // ── Documents ──

  findDocuments(...args: Parameters<HrDocumentService['findDocuments']>) {
    return this.document.findDocuments(...args);
  }

  createDocument(...args: Parameters<HrDocumentService['createDocument']>) {
    return this.document.createDocument(...args);
  }

  uploadDocument(...args: Parameters<HrDocumentService['uploadDocument']>) {
    return this.document.uploadDocument(...args);
  }

  findDocumentById(...args: Parameters<HrDocumentService['findDocumentById']>) {
    return this.document.findDocumentById(...args);
  }

  deleteDocument(...args: Parameters<HrDocumentService['deleteDocument']>) {
    return this.document.deleteDocument(...args);
  }

  // ── Dashboard summary BFF ──

  /**
   * يُنفّذ إجازات + إقامات + سلف بالتوازي ويُعيد ملخصاً واحداً.
   * يحلّ مشكلة "تغيّر الأرقام" في بطاقة ملخص الموارد البشرية.
   */
  async getDashboardSummary(companyId: string) {
    const EXPIRY_DAYS = 90;
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${currentYear + 1}-01-01T00:00:00.000Z`);
    const now = new Date();
    const expiryMax = new Date(now.getTime() + EXPIRY_DAYS * 86_400_000);

    const [
      activeCount,
      terminatedCount,
      leavesCount,
      expiringResidenciesCount,
      advances,
      activeEmployees,
      customAllowanceGroups,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { companyId, status: 'active' } }),
      this.prisma.employee.count({ where: { companyId, status: 'terminated' } }),
      this.prisma.leave.count({
        where: { companyId, startDate: { gte: yearStart, lt: yearEnd } },
      }),
      this.prisma.employeeResidency.count({
        where: {
          companyId,
          expiryDate: { gte: now, lte: expiryMax },
        },
      }),
      this.payroll.findAdvanceInvoices(companyId),
      this.prisma.employee.findMany({
        where: { companyId, status: 'active' },
        select: {
          id: true,
          basicSalary: true,
          housingAllowance: true,
          transportAllowance: true,
          otherAllowance: true,
          workHours: true,
          workSchedule: true,
        },
      }),
      this.prisma.employeeCustomAllowance.groupBy({
        by: ['employeeId'],
        where: { companyId, employee: { status: 'active' } },
        _sum: { amount: true },
      }),
    ]);

    const customByEmployee = new Map<string, number>();
    for (const row of customAllowanceGroups) {
      customByEmployee.set(row.employeeId, Number(row._sum.amount ?? 0));
    }

    const monthlyPayrollTotal = sumMonthlyPayrollForActiveEmployees(activeEmployees, customByEmployee);

    const outstandingAdvances = (advances as any[]).filter(
      (a) => a.status !== 'cancelled' && Number(a.settledAmount ?? 0) < Number(a.totalAmount ?? 0),
    );

    return {
      leavesCount,
      expiringResidenciesCount,
      outstandingAdvancesCount: outstandingAdvances.length,
      outstandingAdvancesAmount: outstandingAdvances.reduce(
        (s: number, a: any) =>
          s + Math.max(0, Number(a.totalAmount ?? 0) - Number(a.settledAmount ?? 0)),
        0,
      ),
      activeCount,
      terminatedCount,
      monthlyPayrollTotal,
    };
  }
}

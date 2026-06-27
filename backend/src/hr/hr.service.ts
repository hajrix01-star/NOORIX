/**
 * HRService — واجهة نحو HrPayroll / HrLeave / HrResidency / HrDocument (بدون تغيير مسارات الـ API).
 */
import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { HrPayrollService } from './hr-payroll.service';
import { HrLeaveService } from './hr-leave.service';
import { HrResidencyService } from './hr-residency.service';
import { HrDocumentService } from './hr-document.service';
import { HrCompensationSnapshotService } from './hr-compensation-snapshot.service';
import { getHrAdvanceTotals } from './hr-advance-balance.util';

@Injectable()
export class HRService {
  constructor(
    private readonly payroll: HrPayrollService,
    private readonly leave: HrLeaveService,
    private readonly residency: HrResidencyService,
    private readonly document: HrDocumentService,
    private readonly compensationSnapshot: HrCompensationSnapshotService,
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

  getEmployeeCompensationSnapshot(companyId: string, employeeId: string) {
    return this.compensationSnapshot.getEmployeeSnapshot(companyId, employeeId);
  }

  getCompanyCompensationSnapshots(companyId: string, employeeIds?: string[]) {
    return this.compensationSnapshot.getCompanySnapshots(companyId, employeeIds);
  }

  // ── Movements, allowances, deductions (مع المسير في نفس خدمة الرواتب) ──

  findMovements(...args: Parameters<HrPayrollService['findMovements']>) {
    return this.payroll.findMovements(...args);
  }

  createMovement(...args: Parameters<HrPayrollService['createMovement']>) {
    return this.payroll.createMovement(...args);
  }

  updateRaiseMovement(...args: Parameters<HrPayrollService['updateRaiseMovement']>) {
    return this.payroll.updateRaiseMovement(...args);
  }

  deleteRaiseMovement(...args: Parameters<HrPayrollService['deleteRaiseMovement']>) {
    return this.payroll.deleteRaiseMovement(...args);
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
        select: { id: true },
      }),
    ]);

    const activeEmployeeIds = activeEmployees.map((employee) => employee.id);
    const salarySnapshots: Awaited<ReturnType<HrCompensationSnapshotService['getCompanySnapshots']>> = activeEmployeeIds.length
      ? await this.compensationSnapshot.getCompanySnapshots(companyId, activeEmployeeIds)
      : { source: 'database', companyId, calculatedAt: new Date().toISOString(), items: [] };
    const monthlyPayrollTotal = salarySnapshots.items.reduce((sum, snapshot) => {
      const total = Number(snapshot?.salaryPackage?.total);
      if (!Number.isFinite(total)) {
        throw new Error('تعذر تحميل ملخص الرواتب من المصدر المركزي.');
      }
      return sum + total;
    }, 0);

    const advanceTotals = getHrAdvanceTotals(advances as any[]);

    return {
      leavesCount,
      expiringResidenciesCount,
      outstandingAdvancesCount: advanceTotals.remainingCount,
      outstandingAdvancesAmount: advanceTotals.remainingAmount,
      activeCount,
      terminatedCount,
      monthlyPayrollTotal,
    };
  }
}

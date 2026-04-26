/**
 * HRService — واجهة نحو HrPayroll / HrLeave / HrResidency / HrDocument (بدون تغيير مسارات الـ API).
 */
import { Injectable } from '@nestjs/common';
import { HrPayrollService } from './hr-payroll.service';
import { HrLeaveService } from './hr-leave.service';
import { HrResidencyService } from './hr-residency.service';
import { HrDocumentService } from './hr-document.service';

@Injectable()
export class HRService {
  constructor(
    private readonly payroll: HrPayrollService,
    private readonly leave: HrLeaveService,
    private readonly residency: HrResidencyService,
    private readonly document: HrDocumentService,
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
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TenantContext } from '../common/tenant-context';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { assertVaultsUsableForPayment } from '../vaults/assert-vaults-for-payment.util';
import type { IssueIndividualSalaryPaymentDto } from './dto/issue-individual-salary-payment.dto';

export const INDIVIDUAL_SALARY_BATCH_PREFIX = 'salary-individual:';

export function payrollMonthStart(value: string): Date {
  const date = new Date(`${toYmd(value)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('شهر الراتب غير صالح.');
  date.setUTCDate(1);
  return date;
}

export function individualSalaryBatchId(employeeId: string, payrollMonth: Date): string {
  return `${INDIVIDUAL_SALARY_BATCH_PREFIX}${employeeId}:${toYmd(payrollMonth)}`;
}

@Injectable()
export class HrPayrollIndividualPaymentService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly accountingCore: AccountingCoreService,
    private readonly audit: AuditLogService,
  ) {}

  async issue(dto: IssueIndividualSalaryPaymentDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const payrollMonth = payrollMonthStart(dto.payrollMonth);
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId: dto.companyId, status: { not: 'terminated' } },
      select: { id: true, name: true, basicSalary: true, housingAllowance: true, transportAllowance: true, otherAllowance: true },
    });
    if (!employee) throw new NotFoundException('الموظف غير موجود أو غير نشط.');
    await assertVaultsUsableForPayment(this.prisma, dto.companyId, [dto.vaultId]);

    const existingRun = await this.prisma.payrollRun.findFirst({
      where: { companyId: dto.companyId, payrollMonth },
      include: { items: { where: { employeeId: dto.employeeId }, select: { netSalary: true } } },
    });
    if (existingRun?.status === 'completed') {
      throw new BadRequestException('هذا المسير معتمد؛ استخدم صرف المسير أو افتح تصحيحاً بإذن المالك.');
    }

    const batchId = individualSalaryBatchId(dto.employeeId, payrollMonth);
    const paid = await this.prisma.invoice.aggregate({
      where: { companyId: dto.companyId, kind: 'salary', status: 'active', batchId },
      _sum: { totalAmount: true },
    });
    const ceiling = existingRun?.items[0]?.netSalary
      ?? new Prisma.Decimal(employee.basicSalary).plus(employee.housingAllowance).plus(employee.transportAllowance).plus(employee.otherAllowance);
    const nextTotal = new Prisma.Decimal(paid._sum.totalAmount ?? 0).plus(dto.amount);
    if (nextTotal.gt(ceiling)) {
      throw new BadRequestException(`دفعات الراتب لهذا الشهر تتجاوز المتبقي للموظف (${ceiling.toFixed(2)} ر.س).`);
    }

    const result = await this.accountingCore.postHrServiceExpense({
      companyId: dto.companyId,
      employeeId: dto.employeeId,
      kind: 'salary',
      totalAmount: String(dto.amount),
      netAmount: String(dto.amount),
      taxAmount: '0',
      transactionDate: toYmd(dto.transactionDate),
      invoiceDate: toYmd(payrollMonth),
      vaultId: dto.vaultId,
      batchId,
      idempotencyKey: dto.idempotencyKey,
      notes: dto.notes?.trim() || `دفعة راتب فردية — ${employee.name} — ${toYmd(payrollMonth)}`,
    }, userId);

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'individual_salary_payment',
      entityId: result.invoice.id,
      newValue: { employeeId: dto.employeeId, payrollMonth: toYmd(payrollMonth), amount: dto.amount, invoiceNumber: result.invoice.invoiceNumber },
    });
    return { invoice: result.invoice, payrollMonth: toYmd(payrollMonth) };
  }
}

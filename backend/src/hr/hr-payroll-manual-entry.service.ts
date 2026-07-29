import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { TenantContext } from '../common/tenant-context';
import { toMoneyDecimal2 } from '../common/utils/money-decimal';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { CreateAllowanceDto } from './dto/create-allowance.dto';
import type { CreateDeductionDto } from './dto/create-deduction.dto';

@Injectable()
export class HrPayrollManualEntryService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAllowances(companyId: string, employeeId?: string) {
    const where: Prisma.EmployeeCustomAllowanceWhereInput = { companyId };
    if (employeeId) where.employeeId = employeeId;
    return this.prisma.employeeCustomAllowance.findMany({
      where,
      include: { employee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAllowance(dto: CreateAllowanceDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const allowance = await this.prisma.employeeCustomAllowance.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        nameAr: dto.nameAr,
        amount: toMoneyDecimal2(dto.amount),
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'employee_custom_allowance',
      entityId: allowance.id,
      newValue: { nameAr: allowance.nameAr, amount: String(allowance.amount) },
    });

    return allowance;
  }

  async deleteAllowance(id: string, companyId: string, userId?: string) {
    const existing = await this.prisma.employeeCustomAllowance.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`البدلة ${id} غير موجودة.`);

    await this.prisma.employeeCustomAllowance.delete({ where: { id } });

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'employee_custom_allowance',
      entityId: id,
      oldValue: { nameAr: existing.nameAr },
    });

    return { deleted: true, id };
  }

  async findDeductions(companyId: string, employeeId?: string) {
    const where: Prisma.EmployeeDeductionWhereInput = { companyId };
    if (employeeId) where.employeeId = employeeId;
    return this.prisma.employeeDeduction.findMany({
      where,
      include: { employee: true },
      orderBy: { transactionDate: 'desc' },
    });
  }

  async createDeduction(dto: CreateDeductionDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const deduction = await this.prisma.employeeDeduction.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        deductionType: dto.deductionType,
        amount: new Prisma.Decimal(dto.amount),
        transactionDate: new Date(dto.transactionDate),
        notes: dto.notes,
        referenceId: dto.referenceId,
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'employee_deduction',
      entityId: deduction.id,
      newValue: { deductionType: deduction.deductionType, amount: String(deduction.amount) },
    });

    return deduction;
  }
}

/**
 * HrPayrollAncillaryService — فواتير السلف (عرض) + حركات الموظف + البدلات + الخصومات اليدوية
 * (يُبقى مربوطاً بمسار HR نفسه بدون الدمج داخل جلسة المسير لتحسين التصفح والصيانة)
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TenantContext } from '../common/tenant-context';
import { toMoneyDecimal2 } from '../common/utils/money-decimal';
import type { CreateMovementDto } from './dto/create-movement.dto';
import type { CreateAllowanceDto } from './dto/create-allowance.dto';
import type { CreateDeductionDto } from './dto/create-deduction.dto';
import type { UpdateRaiseMovementDto } from './dto/update-raise-movement.dto';
import { basicSalaryFromTargetTotalInclusiveOvertime } from './utils/employee-salary-inverse.util';
import { sumHrCustomAllowanceAmounts } from './utils/employee-salary-package.util';

@Injectable()
export class HrPayrollAncillaryService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAdvanceInvoices(companyId: string, year?: number) {
    const where: Prisma.InvoiceWhereInput = {
      companyId,
      kind: 'advance',
      status: 'active',
    };
    if (year) {
      where.transactionDate = {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      };
    }
    return this.prisma.invoice.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, nameEn: true, employeeSerial: true } },
      },
      orderBy: { transactionDate: 'desc' },
      take: 500,
    });
  }

  async findMovements(companyId: string, employeeId?: string) {
    const where: Prisma.EmployeeMovementWhereInput = { companyId };
    if (employeeId) where.employeeId = employeeId;
    return this.prisma.employeeMovement.findMany({
      where,
      include: { employee: true },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  async createMovement(dto: CreateMovementDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const movement = await this.prisma.employeeMovement.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        movementType: dto.movementType,
        amount: dto.amount != null ? new Prisma.Decimal(dto.amount) : null,
        previousValue: dto.previousValue,
        newValue: dto.newValue,
        effectiveDate: new Date(dto.effectiveDate),
        notes: dto.notes,
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'employee_movement',
      entityId: movement.id,
      newValue: { movementType: movement.movementType },
    });

    return movement;
  }

  private async sumCustomAllowances(companyId: string, employeeId: string): Promise<number> {
    const rows = await this.prisma.employeeCustomAllowance.findMany({
      where: { companyId, employeeId },
      select: { amount: true },
    });
    return sumHrCustomAllowanceAmounts(rows);
  }

  private async findLatestRaise(companyId: string, employeeId: string) {
    const raises = await this.prisma.employeeMovement.findMany({
      where: { companyId, employeeId, movementType: 'raise' },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
      take: 1,
    });
    return raises[0] ?? null;
  }

  private roundMoney2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private async applyBasicFromTargetTotal(
    employeeId: string,
    companyId: string,
    employee: {
      basicSalary: Prisma.Decimal;
      housingAllowance: Prisma.Decimal;
      transportAllowance: Prisma.Decimal;
      otherAllowance: Prisma.Decimal;
      workHours: string | null;
      workSchedule: string | null;
    },
    targetTotal: number,
  ) {
    const customTotal = await this.sumCustomAllowances(companyId, employeeId);
    const { basic, inverseWarning } = basicSalaryFromTargetTotalInclusiveOvertime(
      employee,
      customTotal,
      targetTotal,
    );
    if (inverseWarning || basic <= 0) {
      throw new BadRequestException('لا يمكن استنتاج الراتب الأساسي من الإجمالي المطلوب.');
    }
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { basicSalary: new Prisma.Decimal(basic) },
    });
    return basic;
  }

  async updateRaiseMovement(
    id: string,
    companyId: string,
    dto: UpdateRaiseMovementDto,
    userId?: string,
  ) {
    const movement = await this.prisma.employeeMovement.findFirst({
      where: { id, companyId },
      include: { employee: true },
    });
    if (!movement) throw new NotFoundException('الحركة غير موجودة.');
    if (movement.movementType !== 'raise') {
      throw new BadRequestException('يمكن تعديل زيادات الراتب فقط.');
    }

    const increment = this.roundMoney2(Number(dto.increment));
    if (!Number.isFinite(increment) || increment === 0) {
      throw new BadRequestException('مبلغ الزيادة يجب أن يكون غير صفر.');
    }

    const prevTotal = Number(movement.previousValue);
    if (!Number.isFinite(prevTotal)) {
      throw new BadRequestException('لا يمكن تعديل الزيادة — الإجمالي السابق غير مسجّل.');
    }

    const newTarget = this.roundMoney2(prevTotal + increment);
    if (newTarget <= 0) {
      throw new BadRequestException('الإجمالي بعد الزيادة يجب أن يكون أكبر من صفر.');
    }

    const latest = await this.findLatestRaise(companyId, movement.employeeId);
    const isLatest = latest?.id === movement.id;

    if (isLatest) {
      await this.applyBasicFromTargetTotal(
        movement.employeeId,
        companyId,
        movement.employee,
        newTarget,
      );
    }

    const updated = await this.prisma.employeeMovement.update({
      where: { id },
      data: {
        amount: increment > 0 ? new Prisma.Decimal(increment) : null,
        newValue: String(newTarget),
        effectiveDate: new Date(dto.effectiveDate),
        notes: dto.notes?.trim() || null,
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'employee_movement',
      entityId: id,
      newValue: { movementType: 'raise', newValue: updated.newValue },
    });

    return { ...updated, salaryUpdated: isLatest };
  }

  async deleteRaiseMovement(id: string, companyId: string, userId?: string) {
    const movement = await this.prisma.employeeMovement.findFirst({
      where: { id, companyId },
      include: { employee: true },
    });
    if (!movement) throw new NotFoundException('الحركة غير موجودة.');
    if (movement.movementType !== 'raise') {
      throw new BadRequestException('يمكن حذف زيادات الراتب فقط.');
    }

    const latest = await this.findLatestRaise(companyId, movement.employeeId);
    const isLatest = latest?.id === movement.id;

    if (isLatest) {
      const prevTotal = Number(movement.previousValue);
      if (!Number.isFinite(prevTotal)) {
        throw new BadRequestException('لا يمكن التراجع عن الزيادة — الإجمالي السابق غير مسجّل.');
      }
      await this.applyBasicFromTargetTotal(
        movement.employeeId,
        companyId,
        movement.employee,
        prevTotal,
      );
    }

    await this.prisma.employeeMovement.delete({ where: { id } });

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'employee_movement',
      entityId: id,
      oldValue: { movementType: 'raise', previousValue: movement.previousValue },
    });

    return { deleted: true, id, salaryReverted: isLatest };
  }

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

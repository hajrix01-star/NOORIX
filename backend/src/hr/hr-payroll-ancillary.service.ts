/**
 * HrPayrollAncillaryService — فواتير السلف (عرض) + حركات الموظف + البدلات + الخصومات اليدوية
 * (يُبقى مربوطاً بمسار HR نفسه بدون الدمج داخل جلسة المسير لتحسين التصفح والصيانة)
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { roundMoney } from '@noorix/finance-core';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TenantContext } from '../common/tenant-context';
import type { CreateMovementDto } from './dto/create-movement.dto';
import type { UpdateRaiseMovementDto } from './dto/update-raise-movement.dto';
import { basicSalaryFromTargetTotalInclusiveOvertime } from './utils/employee-salary-inverse.util';
import { HrCompensationSnapshotService } from './hr-compensation-snapshot.service';
import { HrPayrollManualEntryService } from './hr-payroll-manual-entry.service';

@Injectable()
export class HrPayrollAncillaryService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
    private readonly compensationSnapshot: HrCompensationSnapshotService,
    private readonly manualEntries: HrPayrollManualEntryService,
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
    if (dto.movementType === 'raise') {
      return this.createRaiseMovement(dto, userId);
    }

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

  private async getCentralSalaryPackage(companyId: string, employeeId: string) {
    const snapshotResult = await this.compensationSnapshot.getCompanySnapshots(companyId, [employeeId]);
    const snapshot = snapshotResult.items[0];
    const salaryPackage = snapshot?.salaryPackage;
    const total = Number(salaryPackage?.total);
    const customAllowanceTotal = Number(salaryPackage?.customAllowanceTotal);
    if (!salaryPackage || !Number.isFinite(total) || total <= 0 || !Number.isFinite(customAllowanceTotal)) {
      throw new BadRequestException('تعذر تحميل راتب الموظف من المصدر المركزي.');
    }
    return { snapshot, salaryPackage, total, customAllowanceTotal };
  }

  private resolveRaiseIncrement(dto: CreateMovementDto, currentTotal: number): number {
    const previousValue = Number(dto.previousValue);
    if (Number.isFinite(previousValue) && Math.abs(previousValue - currentTotal) > 0.02) {
      throw new BadRequestException('إجمالي الراتب السابق لا يطابق المصدر المركزي.');
    }

    const amount = Number(dto.amount);
    if (Number.isFinite(amount) && amount > 0) {
      const roundedAmount = this.roundMoney2(amount);
      const requestedNewValue = Number(dto.newValue);
      if (Number.isFinite(requestedNewValue) && Math.abs(requestedNewValue - this.roundMoney2(currentTotal + roundedAmount)) > 0.02) {
        throw new BadRequestException('إجمالي الراتب الجديد لا يطابق المصدر المركزي.');
      }
      return roundedAmount;
    }

    const newValue = Number(dto.newValue);
    if (Number.isFinite(newValue)) return this.roundMoney2(newValue - currentTotal);

    throw new BadRequestException('مبلغ زيادة الراتب مطلوب من المصدر المركزي.');
  }

  private async createRaiseMovement(dto: CreateMovementDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId: dto.companyId },
      select: {
        id: true,
        basicSalary: true,
        housingAllowance: true,
        transportAllowance: true,
        otherAllowance: true,
        workHours: true,
        workSchedule: true,
      },
    });
    if (!employee) throw new NotFoundException('الموظف غير موجود.');

    const salarySource = await this.getCentralSalaryPackage(dto.companyId, dto.employeeId);
    const increment = this.resolveRaiseIncrement(dto, salarySource.total);
    if (!Number.isFinite(increment) || increment === 0) {
      throw new BadRequestException('مبلغ الزيادة يجب أن يكون غير صفر.');
    }

    const newTarget = this.roundMoney2(salarySource.total + increment);
    if (newTarget <= 0) {
      throw new BadRequestException('الإجمالي بعد الزيادة يجب أن يكون أكبر من صفر.');
    }

    const { basic, inverseWarning } = basicSalaryFromTargetTotalInclusiveOvertime(
      employee,
      salarySource.customAllowanceTotal,
      newTarget,
    );
    if (inverseWarning || basic <= 0) {
      throw new BadRequestException('لا يمكن استنتاج الراتب الأساسي من الإجمالي المطلوب.');
    }

    const movement = await this.prisma.withTenant(async (tx) => {
      await tx.employee.update({
        where: { id: dto.employeeId },
        data: { basicSalary: new Prisma.Decimal(basic) },
      });
      return tx.employeeMovement.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          employeeId: dto.employeeId,
          movementType: 'raise',
          amount: increment > 0 ? new Prisma.Decimal(increment) : null,
          previousValue: String(this.roundMoney2(salarySource.total)),
          newValue: String(newTarget),
          effectiveDate: new Date(dto.effectiveDate),
          notes: dto.notes,
        },
        include: { employee: true },
      });
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'employee_movement',
      entityId: movement.id,
      newValue: {
        movementType: 'raise',
        source: 'hr_compensation_snapshot',
        previousValue: movement.previousValue,
        newValue: movement.newValue,
      },
    });

    return { ...movement, salaryUpdated: true };
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
    return roundMoney(n);
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
    const salarySource = await this.getCentralSalaryPackage(companyId, employeeId);
    const { basic, inverseWarning } = basicSalaryFromTargetTotalInclusiveOvertime(
      employee,
      salarySource.customAllowanceTotal,
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

  findAllowances(...args: Parameters<HrPayrollManualEntryService['findAllowances']>) {
    return this.manualEntries.findAllowances(...args);
  }

  createAllowance(...args: Parameters<HrPayrollManualEntryService['createAllowance']>) {
    return this.manualEntries.createAllowance(...args);
  }

  deleteAllowance(...args: Parameters<HrPayrollManualEntryService['deleteAllowance']>) {
    return this.manualEntries.deleteAllowance(...args);
  }

  findDeductions(...args: Parameters<HrPayrollManualEntryService['findDeductions']>) {
    return this.manualEntries.findDeductions(...args);
  }

  createDeduction(...args: Parameters<HrPayrollManualEntryService['createDeduction']>) {
    return this.manualEntries.createDeduction(...args);
  }
}

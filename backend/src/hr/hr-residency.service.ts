/**
 * HrResidencyService — أرقام الإقامات
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TenantContext } from '../common/tenant-context';
import type { CreateResidencyDto } from './dto/create-residency.dto';
import type { UpdateResidencyDto } from './dto/update-residency.dto';

@Injectable()
export class HrResidencyService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // ══════════════════════════════════════════════════════════
  // RESIDENCIES
  // ══════════════════════════════════════════════════════════

  async findResidencies(companyId: string, employeeId?: string) {
    const where: Prisma.EmployeeResidencyWhereInput = { companyId };
    if (employeeId) where.employeeId = employeeId;
    return this.prisma.employeeResidency.findMany({
      where,
      include: { employee: true },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async createResidency(dto: CreateResidencyDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();
    const residency = await this.prisma.employeeResidency.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        iqamaNumber: dto.iqamaNumber,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: new Date(dto.expiryDate),
        status: dto.status ?? 'active',
        notes: dto.notes,
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'employee_residency',
      entityId: residency.id,
      newValue: { iqamaNumber: residency.iqamaNumber },
    });

    return residency;
  }

  async updateResidency(
    id: string,
    dto: UpdateResidencyDto,
    companyId: string,
    userId?: string,
  ) {
    const existing = await this.prisma.employeeResidency.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`الإقامة ${id} غير موجودة.`);

    const updated = await this.prisma.employeeResidency.update({
      where: { id },
      data: {
        ...(dto.iqamaNumber !== undefined && { iqamaNumber: dto.iqamaNumber }),
        ...(dto.issueDate !== undefined && { issueDate: new Date(dto.issueDate) }),
        ...(dto.expiryDate !== undefined && { expiryDate: new Date(dto.expiryDate) }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { employee: true },
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'employee_residency',
      entityId: id,
      oldValue: { iqamaNumber: existing.iqamaNumber },
      newValue: { iqamaNumber: updated.iqamaNumber },
    });

    return updated;
  }

  async deleteResidency(id: string, companyId: string, userId?: string) {
    const existing = await this.prisma.employeeResidency.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`الإقامة ${id} غير موجودة.`);

    await this.prisma.employeeResidency.delete({ where: { id } });

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'employee_residency',
      entityId: id,
      oldValue: { iqamaNumber: existing.iqamaNumber },
    });

    return { deleted: true, id };
  }
}

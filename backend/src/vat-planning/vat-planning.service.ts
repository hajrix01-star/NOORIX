import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { isSuperAdmin } from '../auth/constants/permissions';
import type { JwtUser } from '../auth/decorators/current-user.decorator';

export type UpsertVatPlanningDto = {
  companyId: string;
  year: number;
  quarter: number;
  payload: Record<string, unknown>;
  sourceSnapshot?: Record<string, unknown> | null;
  paymentTarget?: number | null;
  notes?: string | null;
  importedAt?: string | null;
};

@Injectable()
export class VatPlanningService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private assertCompanyAccess(user: JwtUser, companyId: string) {
    const role = (user.role || '').toLowerCase();
    if (isSuperAdmin(role)) return;
    const ids = user.companyIds || [];
    if (!ids.includes(companyId)) {
      throw new ForbiddenException('غير مصرح لك بالوصول لهذه الشركة.');
    }
  }

  private async resolveTenantForCompany(companyId: string): Promise<string> {
    const ctxTenant = TenantContext.getTenantId();
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: { tenantId: true },
    });
    if (!company) {
      throw new NotFoundException('الشركة غير موجودة.');
    }
    if (ctxTenant && company.tenantId !== ctxTenant) {
      throw new ForbiddenException('الشركة لا تنتمي للمستأجر الحالي.');
    }
    return company.tenantId;
  }

  /**
   * سجلُّ الإقرارات المحفوظة — اختياري: سنة، ربع، شركة. مرتب: سنة ↓، ربع ↓، اسم الشركة.
   */
  async listRegistry(
    user: JwtUser,
    filters: { year?: number; quarter?: number; companyId?: string },
  ) {
    const role = (user.role || '').toLowerCase();
    const isSuper = isSuperAdmin(role);
    const allowedIds = user.companyIds || [];

    const where: Prisma.VatPlanningQuarterWhereInput = {};

    if (filters.companyId) {
      this.assertCompanyAccess(user, filters.companyId);
      where.companyId = filters.companyId;
    } else if (!isSuper) {
      if (allowedIds.length === 0) return { success: true, data: [] as unknown[] };
      where.companyId = { in: allowedIds };
    }

    if (filters.year != null && Number.isFinite(filters.year)) {
      where.year = filters.year;
    }
    if (
      filters.quarter != null &&
      Number.isFinite(filters.quarter) &&
      filters.quarter >= 1 &&
      filters.quarter <= 4
    ) {
      where.quarter = filters.quarter;
    }

    const rows = await this.prisma.vatPlanningQuarter.findMany({
      where,
      include: {
        company: { select: { id: true, nameAr: true, nameEn: true, taxNumber: true } },
      },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }, { company: { nameAr: 'asc' } }],
    });

    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        companyId: r.companyId,
        year: r.year,
        quarter: r.quarter,
        payload: r.payload,
        sourceSnapshot: r.sourceSnapshot,
        paymentTarget: r.paymentTarget?.toString() ?? null,
        notes: r.notes,
        importedAt: r.importedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
        company: r.company,
      })),
    };
  }

  async list(user: JwtUser, year: number, quarter: number, companyId?: string) {
    if (!Number.isFinite(year) || !Number.isFinite(quarter) || quarter < 1 || quarter > 4) {
      throw new BadRequestException('year أو quarter غير صالح.');
    }
    const role = (user.role || '').toLowerCase();
    const isSuper = isSuperAdmin(role);
    const allowedIds = user.companyIds || [];

    const where: Prisma.VatPlanningQuarterWhereInput = { year, quarter };

    if (companyId) {
      this.assertCompanyAccess(user, companyId);
      where.companyId = companyId;
    } else if (!isSuper) {
      if (allowedIds.length === 0) return { success: true, data: [] as unknown[] };
      where.companyId = { in: allowedIds };
    }

    const rows = await this.prisma.vatPlanningQuarter.findMany({
      where,
      include: {
        company: { select: { id: true, nameAr: true, nameEn: true, taxNumber: true } },
      },
      orderBy: [{ company: { nameAr: 'asc' } }],
    });

    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        companyId: r.companyId,
        year: r.year,
        quarter: r.quarter,
        payload: r.payload,
        sourceSnapshot: r.sourceSnapshot,
        paymentTarget: r.paymentTarget?.toString() ?? null,
        notes: r.notes,
        importedAt: r.importedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
        company: r.company,
      })),
    };
  }

  async upsert(user: JwtUser, dto: UpsertVatPlanningDto) {
    const { companyId, year, quarter } = dto;
    if (!companyId || !Number.isFinite(year) || !Number.isFinite(quarter) || quarter < 1 || quarter > 4) {
      throw new BadRequestException('بيانات غير صالحة.');
    }
    this.assertCompanyAccess(user, companyId);
    const tenantId = await this.resolveTenantForCompany(companyId);

    const paymentTarget =
      dto.paymentTarget != null && Number.isFinite(Number(dto.paymentTarget))
        ? new Prisma.Decimal(String(dto.paymentTarget))
        : null;

    const importedAt = dto.importedAt ? new Date(dto.importedAt) : null;
    if (importedAt && Number.isNaN(importedAt.getTime())) {
      throw new BadRequestException('importedAt غير صالح.');
    }

    const payload = dto.payload ?? {};
    const sourceSnapshot = dto.sourceSnapshot ?? undefined;

    const row = await this.prisma.vatPlanningQuarter.upsert({
      where: {
        companyId_year_quarter: { companyId, year, quarter },
      },
      create: {
        tenantId,
        companyId,
        year,
        quarter,
        payload: payload as Prisma.InputJsonValue,
        sourceSnapshot: sourceSnapshot !== undefined ? (sourceSnapshot as Prisma.InputJsonValue) : undefined,
        paymentTarget,
        notes: dto.notes ?? null,
        importedAt: importedAt ?? undefined,
      },
      update: {
        payload: payload as Prisma.InputJsonValue,
        ...(sourceSnapshot !== undefined ? { sourceSnapshot: sourceSnapshot as Prisma.InputJsonValue } : {}),
        paymentTarget,
        notes: dto.notes ?? null,
        ...(dto.importedAt !== undefined ? { importedAt } : {}),
      },
      include: {
        company: { select: { id: true, nameAr: true, nameEn: true, taxNumber: true } },
      },
    });

    return {
      success: true,
      data: {
        id: row.id,
        companyId: row.companyId,
        year: row.year,
        quarter: row.quarter,
        payload: row.payload,
        sourceSnapshot: row.sourceSnapshot,
        paymentTarget: row.paymentTarget?.toString() ?? null,
        notes: row.notes,
        importedAt: row.importedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
        company: row.company,
      },
    };
  }

  async remove(user: JwtUser, companyId: string, year: number, quarter: number) {
    this.assertCompanyAccess(user, companyId);
    await this.resolveTenantForCompany(companyId);

    await this.prisma.vatPlanningQuarter.deleteMany({
      where: { companyId, year, quarter },
    });
    return { success: true };
  }
}

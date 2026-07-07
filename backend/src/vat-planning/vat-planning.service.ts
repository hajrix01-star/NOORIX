import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { isSuperAdmin } from '../auth/constants/permissions';
import type { JwtUser } from '../auth/decorators/current-user.decorator';

type VatPlanningLineValue = {
  amount: number;
  adjustment: number;
  vat: number;
};

type VatPlanningPayload = Record<string, number | VatPlanningLineValue>;

const DISCLOSURE_LINE_KEYS = ['standard_sales', 'standard_purchases'] as const;

export type UpsertVatPlanningDto = {
  companyId: string;
  year: number;
  quarter: number;
  payload: Record<string, unknown>;
  sourceSnapshot?: Record<string, unknown> | null;
  paymentTarget?: number | null;
  notes?: string | null;
  importedAt?: string | null;
  /** اعتماد التقديم في السجل؛ إن غُفل عند التحديث يُحافَظ على القيمة الحالية في قاعدة البيانات */
  filingSubmitted?: boolean;
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

  private money(value: unknown): number {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.round(numericValue * 100) / 100;
  }

  private lineValue(value: unknown): VatPlanningLineValue {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { amount: 0, adjustment: 0, vat: 0 };
    }
    const record = value as Record<string, unknown>;
    return {
      amount: this.money(record.amount),
      adjustment: this.money(record.adjustment),
      vat: this.money(record.vat),
    };
  }

  private normalizePayload(payload: unknown): VatPlanningPayload {
    const source = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const next: VatPlanningPayload = {};
    for (const key of DISCLOSURE_LINE_KEYS) {
      next[key] = this.lineValue(source[key]);
    }
    const outputTotal = this.money(this.lineValue(next.standard_sales).vat);
    const inputTotal = this.money(this.lineValue(next.standard_purchases).vat);
    const netVat = this.money(outputTotal - inputTotal);
    const priorAdjustments = this.money(source.prior_adjustments);
    const balanceCarried = this.money(source.balance_carried);
    next.vat_due = outputTotal;
    next.vat_recoverable = inputTotal;
    next.net_vat = netVat;
    next.prior_adjustments = priorAdjustments;
    next.balance_carried = balanceCarried;
    next.net_payable_refund = this.money(netVat + priorAdjustments + balanceCarried);
    return next;
  }

  private allowedCompanyFilter(user: JwtUser): Prisma.CompanyWhereInput {
    const role = (user.role || '').toLowerCase();
    if (isSuperAdmin(role)) return {};
    const allowedIds = user.companyIds || [];
    return allowedIds.length > 0 ? { id: { in: allowedIds } } : { id: { in: [] } };
  }

  private allowedVatPlanningFilter(user: JwtUser): Prisma.VatPlanningQuarterWhereInput {
    const role = (user.role || '').toLowerCase();
    if (isSuperAdmin(role)) return {};
    const allowedIds = user.companyIds || [];
    return allowedIds.length > 0 ? { companyId: { in: allowedIds } } : { companyId: { in: [] } };
  }

  async registryMetadata(user: JwtUser) {
    const [companies, years] = await Promise.all([
      this.prisma.company.findMany({
        where: {
          ...this.allowedCompanyFilter(user),
          isArchived: false,
        },
        select: { id: true, nameAr: true, nameEn: true, taxNumber: true, isArchived: true },
        orderBy: [{ nameAr: 'asc' }, { nameEn: 'asc' }],
      }),
      this.prisma.vatPlanningQuarter.groupBy({
        by: ['year'],
        where: this.allowedVatPlanningFilter(user),
        orderBy: { year: 'desc' },
      }),
    ]);

    return {
      success: true,
      data: {
        companies,
        years: years.map((row) => row.year).filter((year) => Number.isFinite(year) && year >= 2000),
      },
    };
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
      if (allowedIds.length === 0) return { success: true, data: [] };
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
        company: {
          select: { id: true, nameAr: true, nameEn: true, taxNumber: true, isArchived: true },
        },
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
        filingSubmitted: r.filingSubmitted === true,
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
      if (allowedIds.length === 0) return { success: true, data: [] };
      where.companyId = { in: allowedIds };
    }

    const rows = await this.prisma.vatPlanningQuarter.findMany({
      where,
      include: {
        company: {
          select: { id: true, nameAr: true, nameEn: true, taxNumber: true, isArchived: true },
        },
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
        filingSubmitted: r.filingSubmitted === true,
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

    const payload = this.normalizePayload(dto.payload);
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
        filingSubmitted: dto.filingSubmitted ?? false,
      },
      update: {
        payload: payload as Prisma.InputJsonValue,
        ...(sourceSnapshot !== undefined ? { sourceSnapshot: sourceSnapshot as Prisma.InputJsonValue } : {}),
        paymentTarget,
        notes: dto.notes ?? null,
        ...(dto.importedAt !== undefined ? { importedAt } : {}),
        ...(dto.filingSubmitted !== undefined ? { filingSubmitted: dto.filingSubmitted } : {}),
      },
      include: {
        company: {
          select: { id: true, nameAr: true, nameEn: true, taxNumber: true, isArchived: true },
        },
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
        filingSubmitted: row.filingSubmitted === true,
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

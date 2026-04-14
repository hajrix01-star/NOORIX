/**
 * CompanyAsset — سجل أصول تشغيلي (بدون إهلاك): ضمان، مدة، تقارير.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { CreateCompanyAssetDto } from './dto/create-company-asset.dto';
import { UpdateCompanyAssetDto } from './dto/update-company-asset.dto';

function parseDateOnly(iso: string | undefined | null): Date | null {
  if (!iso || typeof iso !== 'string') return null;
  const s = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** إضافة أشهر بتقويم UTC مع معالجة نهاية الشهر */
function addMonthsUtc(start: Date, months: number): Date {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const day = start.getUTCDate();
  const lastDayOfTarget = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();
  const newDay = Math.min(day, lastDayOfTarget);
  return new Date(Date.UTC(y, m + months, newDay));
}

function utcToday(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function addDaysUtc(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

function daysBetweenUtc(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86400000);
}

export type WarrantyFilter = 'all' | 'active' | 'expired' | 'expiring90' | 'none';

@Injectable()
export class CompanyAssetsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private async assertSupplierCompany(supplierId: string | undefined, companyId: string): Promise<void> {
    if (!supplierId) return;
    const s = await this.prisma.supplier.findFirst({
      where: { id: supplierId, companyId, isDeleted: false },
      select: { id: true },
    });
    if (!s) throw new BadRequestException('المورد غير موجود أو لا يتبع هذه الشركة');
  }

  private async assertInvoiceCompany(invoiceId: string | undefined, companyId: string): Promise<void> {
    if (!invoiceId) return;
    const inv = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { id: true },
    });
    if (!inv) throw new BadRequestException('الفاتورة غير موجودة أو لا تتبع هذه الشركة');
  }

  /**
   * يحدد تاريخي بداية ونهاية الضمان المخزّنين.
   * أولوية نهاية صريحة؛ وإلا بداية + أشهر.
   */
  private computeWarrantyStorage(input: {
    purchaseDate: Date | null;
    warrantyMonths: number | null;
    warrantyStartDate: Date | null;
    warrantyEndDate: Date | null;
  }): {
    warrantyStartDate: Date | null;
    warrantyEndDate: Date | null;
    warrantyMonths: number | null;
  } {
    const monthsNum = input.warrantyMonths != null ? Number(input.warrantyMonths) : null;
    const start = input.warrantyStartDate ?? input.purchaseDate ?? null;
    let end = input.warrantyEndDate ?? null;
    if (!end && start && monthsNum != null && monthsNum > 0) {
      end = addMonthsUtc(start, monthsNum);
    }
    return {
      warrantyStartDate: start,
      warrantyEndDate: end,
      warrantyMonths: monthsNum,
    };
  }

  private mapRow(row: {
    id: string;
    nameAr: string;
    nameEn: string | null;
    serialNumber: string | null;
    location: string | null;
    purchaseDate: Date | null;
    acquisitionCost: Prisma.Decimal | null;
    warrantyDescription: string | null;
    warrantyMonths: number | null;
    warrantyStartDate: Date | null;
    warrantyEndDate: Date | null;
    notes: string | null;
    supplier: { id: string; nameAr: string; nameEn: string | null } | null;
    invoice: { id: string; invoiceNumber: string; supplierInvoiceNumber: string | null } | null;
  }) {
    const today = utcToday();
    const end = row.warrantyEndDate;
    let warrantyStatus: 'none' | 'active' | 'expired' | 'expiring' = 'none';
    let daysToWarrantyEnd: number | null = null;
    if (end) {
      daysToWarrantyEnd = daysBetweenUtc(today, end);
      if (daysToWarrantyEnd < 0) warrantyStatus = 'expired';
      else if (daysToWarrantyEnd <= 90) warrantyStatus = 'expiring';
      else warrantyStatus = 'active';
    }
    return {
      ...row,
      acquisitionCost: row.acquisitionCost != null ? row.acquisitionCost.toString() : null,
      warrantyStatus,
      daysToWarrantyEnd,
    };
  }

  async findAll(
    companyId: string,
    opts: {
      warrantyFilter?: WarrantyFilter;
      q?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
    const warrantyFilter = opts.warrantyFilter ?? 'all';
    const q = (opts.q ?? '').trim();

    const today = utcToday();
    const day90 = addDaysUtc(today, 90);

    const where: Prisma.CompanyAssetWhereInput = { companyId };

    if (q) {
      where.OR = [
        { nameAr: { contains: q, mode: 'insensitive' } },
        { nameEn: { contains: q, mode: 'insensitive' } },
        { serialNumber: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (warrantyFilter === 'none') {
      where.warrantyEndDate = null;
    } else if (warrantyFilter === 'active') {
      where.warrantyEndDate = { gte: today };
    } else if (warrantyFilter === 'expired') {
      where.warrantyEndDate = { lt: today };
    } else if (warrantyFilter === 'expiring90') {
      where.warrantyEndDate = { gte: today, lte: day90 };
    }

    const [rows, total, sumRow] = await Promise.all([
      this.prisma.companyAsset.findMany({
        where,
        orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          supplier: { select: { id: true, nameAr: true, nameEn: true } },
          invoice: { select: { id: true, invoiceNumber: true, supplierInvoiceNumber: true } },
        },
      }),
      this.prisma.companyAsset.count({ where }),
      this.prisma.companyAsset.aggregate({
        where: { companyId },
        _sum: { acquisitionCost: true },
      }),
    ]);

    const items = rows.map((r) => this.mapRow(r));

    return {
      items,
      total,
      page,
      pageSize,
      sumAcquisitionCostAll: sumRow._sum.acquisitionCost?.toString() ?? '0',
    };
  }

  async findOne(id: string, companyId: string) {
    const row = await this.prisma.companyAsset.findFirst({
      where: { id, companyId },
      include: {
        supplier: { select: { id: true, nameAr: true, nameEn: true } },
        invoice: { select: { id: true, invoiceNumber: true, supplierInvoiceNumber: true } },
      },
    });
    if (!row) throw new NotFoundException('الأصل غير موجود');
    return this.mapRow(row);
  }

  async create(dto: CreateCompanyAssetDto) {
    const tenantId = TenantContext.getTenantId();
    const nameAr = dto.nameAr?.trim();
    if (!nameAr) throw new BadRequestException('اسم الأصل مطلوب');

    await this.assertSupplierCompany(dto.supplierId, dto.companyId);
    await this.assertInvoiceCompany(dto.invoiceId, dto.companyId);

    const purchaseDate = parseDateOnly(dto.purchaseDate);
    const w = this.computeWarrantyStorage({
      purchaseDate,
      warrantyMonths: dto.warrantyMonths ?? null,
      warrantyStartDate: parseDateOnly(dto.warrantyStartDate) ?? null,
      warrantyEndDate: parseDateOnly(dto.warrantyEndDate) ?? null,
    });

    const cost =
      dto.acquisitionCost != null ? new Prisma.Decimal(String(dto.acquisitionCost)) : null;

    return this.prisma.companyAsset
      .create({
        data: {
          tenantId,
          companyId: dto.companyId,
          nameAr,
          nameEn: dto.nameEn?.trim() || null,
          serialNumber: dto.serialNumber?.trim() || null,
          location: dto.location?.trim() || null,
          purchaseDate,
          acquisitionCost: cost,
          supplierId: dto.supplierId || null,
          invoiceId: dto.invoiceId || null,
          warrantyDescription: dto.warrantyDescription?.trim() || null,
          warrantyMonths: w.warrantyMonths,
          warrantyStartDate: w.warrantyStartDate,
          warrantyEndDate: w.warrantyEndDate,
          notes: dto.notes?.trim() || null,
        },
        include: {
          supplier: { select: { id: true, nameAr: true, nameEn: true } },
          invoice: { select: { id: true, invoiceNumber: true, supplierInvoiceNumber: true } },
        },
      })
      .then((r) => this.mapRow(r));
  }

  async update(id: string, companyId: string, dto: UpdateCompanyAssetDto) {
    const existing = await this.prisma.companyAsset.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('الأصل غير موجود');

    if (dto.nameAr !== undefined && !String(dto.nameAr).trim()) {
      throw new BadRequestException('اسم الأصل مطلوب');
    }

    if (dto.supplierId !== undefined) await this.assertSupplierCompany(dto.supplierId || undefined, companyId);
    if (dto.invoiceId !== undefined) await this.assertInvoiceCompany(dto.invoiceId || undefined, companyId);

    const purchaseDate =
      dto.purchaseDate !== undefined ? parseDateOnly(dto.purchaseDate) : existing.purchaseDate;
    let warrantyMonths =
      dto.warrantyMonths !== undefined ? dto.warrantyMonths : existing.warrantyMonths;
    const warrantyStartDate =
      dto.warrantyStartDate !== undefined
        ? parseDateOnly(dto.warrantyStartDate)
        : existing.warrantyStartDate;
    let warrantyEndDate =
      dto.warrantyEndDate !== undefined ? parseDateOnly(dto.warrantyEndDate) : existing.warrantyEndDate;

    if (dto.warrantyMonths !== undefined && dto.warrantyMonths === 0 && dto.warrantyEndDate === undefined) {
      warrantyEndDate = null;
      warrantyMonths = 0;
    }

    const w = this.computeWarrantyStorage({
      purchaseDate,
      warrantyMonths,
      warrantyStartDate,
      warrantyEndDate,
    });

    const cost =
      dto.acquisitionCost !== undefined
        ? new Prisma.Decimal(String(dto.acquisitionCost))
        : existing.acquisitionCost;

    const row = await this.prisma.companyAsset.update({
      where: { id },
      data: {
        nameAr: dto.nameAr !== undefined ? dto.nameAr.trim() : undefined,
        nameEn: dto.nameEn !== undefined ? dto.nameEn.trim() || null : undefined,
        serialNumber: dto.serialNumber !== undefined ? dto.serialNumber.trim() || null : undefined,
        location: dto.location !== undefined ? dto.location.trim() || null : undefined,
        purchaseDate: dto.purchaseDate !== undefined ? parseDateOnly(dto.purchaseDate) : undefined,
        acquisitionCost: dto.acquisitionCost !== undefined ? cost : undefined,
        supplierId: dto.supplierId !== undefined ? dto.supplierId || null : undefined,
        invoiceId: dto.invoiceId !== undefined ? dto.invoiceId || null : undefined,
        warrantyDescription:
          dto.warrantyDescription !== undefined ? dto.warrantyDescription.trim() || null : undefined,
        warrantyMonths: w.warrantyMonths,
        warrantyStartDate: w.warrantyStartDate,
        warrantyEndDate: w.warrantyEndDate,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined,
      },
      include: {
        supplier: { select: { id: true, nameAr: true, nameEn: true } },
        invoice: { select: { id: true, invoiceNumber: true, supplierInvoiceNumber: true } },
      },
    });

    return this.mapRow(row);
  }

  async remove(id: string, companyId: string) {
    const existing = await this.prisma.companyAsset.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('الأصل غير موجود');
    await this.prisma.companyAsset.delete({ where: { id } });
    return { ok: true };
  }
}

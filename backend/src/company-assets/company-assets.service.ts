/**
 * CompanyAsset — سجل أصول تشغيلي (بدون إهلاك): ضمان، مدة، تقارير، قائمة انتظار من المشتريات.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import type { Response } from 'express';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { CreateCompanyAssetDto } from './dto/create-company-asset.dto';
import { UpdateCompanyAssetDto } from './dto/update-company-asset.dto';
import { CompleteCompanyAssetFromInvoiceDto } from './dto/complete-from-invoice.dto';
import {
  addDaysUtc,
  computeWarrantyStorage,
  parseDateOnly,
  utcToday,
} from './company-assets-datetime.util';
import { mapCompanyAssetRow, type WarrantyFilter } from './company-assets-map.util';
import { createCompanyAssetWarrantyLinesTx } from './company-assets-warranty-line-tx.util';

export type { WarrantyFilter };

const ASSET_WARRANTY_ATTACHMENT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function validateWarrantyAttachmentFile(file: Express.Multer.File | undefined) {
  if (!file?.path) return null;
  const mime = file.mimetype || '';
  if (!ASSET_WARRANTY_ATTACHMENT_MIMES.has(mime)) {
    return 'نوع الصورة غير مسموح. استخدم JPG أو PNG أو WEBP أو GIF.';
  }
  return null;
}

@Injectable()
export class CompanyAssetsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private readonly assetDetailInclude = {
    supplier: { select: { id: true, nameAr: true, nameEn: true } },
    invoice: { select: { id: true, invoiceNumber: true, supplierInvoiceNumber: true } },
    warrantyLines: { orderBy: { sortOrder: 'asc' } },
    _count: { select: { warrantyLines: true } },
  } satisfies Prisma.CompanyAssetInclude;

  private async findFullAssetOrThrow(id: string, companyId: string) {
    const full = await this.prisma.companyAsset.findFirst({
      where: { id, companyId },
      include: this.assetDetailInclude,
    });
    if (!full) throw new NotFoundException('الأصل غير موجود');
    return full;
  }

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

    const [rows, total, sumFilteredRow, sumAllRow] = await Promise.all([
      this.prisma.companyAsset.findMany({
        where,
        orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          supplier: { select: { id: true, nameAr: true, nameEn: true } },
          invoice: { select: { id: true, invoiceNumber: true, supplierInvoiceNumber: true } },
          _count: { select: { warrantyLines: true } },
        },
      }),
      this.prisma.companyAsset.count({ where }),
      this.prisma.companyAsset.aggregate({
        where,
        _sum: { acquisitionCost: true },
      }),
      this.prisma.companyAsset.aggregate({
        where: { companyId },
        _sum: { acquisitionCost: true },
      }),
    ]);

    const items = rows.map((r) => mapCompanyAssetRow(r));

    return {
      items,
      total,
      page,
      pageSize,
      sumAcquisitionCostFiltered: sumFilteredRow._sum.acquisitionCost?.toString() ?? '0',
      sumAcquisitionCostAll: sumAllRow._sum.acquisitionCost?.toString() ?? '0',
    };
  }

  async findPendingWarrantyInvoices(companyId: string) {
    const rows = await this.prisma.invoice.findMany({
      where: {
        companyId,
        status: 'active',
        kind: { in: ['purchase', 'expense', 'fixed_expense'] },
        warrantyFollowUp: true,
        warrantyFollowUpDone: false,
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        supplier: { select: { id: true, nameAr: true, nameEn: true } },
        expenseLine: {
          select: {
            nameAr: true,
            nameEn: true,
            supplier: { select: { id: true, nameAr: true, nameEn: true } },
          },
        },
      },
    });
    return rows.map((inv) => {
      const supplier = inv.supplier ?? inv.expenseLine?.supplier ?? null;
      return {
        id: inv.id,
        kind: inv.kind,
        invoiceNumber: inv.invoiceNumber,
        supplierInvoiceNumber: inv.supplierInvoiceNumber,
        transactionDate: inv.transactionDate,
        totalAmount: inv.totalAmount.toString(),
        netAmount: inv.netAmount.toString(),
        taxAmount: inv.taxAmount.toString(),
        notes: inv.notes,
        supplier,
        expenseLine: inv.expenseLine
          ? {
              nameAr: inv.expenseLine.nameAr,
              nameEn: inv.expenseLine.nameEn ?? undefined,
            }
          : null,
      };
    });
  }

  async findOne(id: string, companyId: string) {
    const row = await this.prisma.companyAsset.findFirst({
      where: { id, companyId },
      include: {
        supplier: { select: { id: true, nameAr: true, nameEn: true } },
        invoice: { select: { id: true, invoiceNumber: true, supplierInvoiceNumber: true } },
        warrantyLines: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('الأصل غير موجود');
    return mapCompanyAssetRow(row);
  }

  async downloadWarrantyAttachment(id: string, companyId: string, res: Response): Promise<void> {
    const asset = await this.prisma.companyAsset.findFirst({
      where: { id, companyId },
      select: {
        warrantyAttachmentPath: true,
        warrantyAttachmentOriginalName: true,
        warrantyAttachmentMime: true,
      },
    });
    const p = asset?.warrantyAttachmentPath?.trim();
    if (!asset || !p) {
      throw new NotFoundException('لا توجد صورة ضمان لهذا الأصل.');
    }
    if (!existsSync(p)) {
      throw new NotFoundException('صورة الضمان غير موجودة على الخادم.');
    }

    const name = asset.warrantyAttachmentOriginalName?.trim() || 'warranty-image';
    res.setHeader('Content-Type', asset.warrantyAttachmentMime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.sendFile(p);
  }

  async create(dto: CreateCompanyAssetDto) {
    const tenantId = TenantContext.getTenantId();
    const nameAr = dto.nameAr?.trim();
    if (!nameAr) throw new BadRequestException('اسم الأصل مطلوب');

    await this.assertSupplierCompany(dto.supplierId, dto.companyId);
    await this.assertInvoiceCompany(dto.invoiceId, dto.companyId);

    const purchaseDate = parseDateOnly(dto.purchaseDate);
    const w = computeWarrantyStorage({
      purchaseDate,
      warrantyMonths: dto.warrantyMonths ?? null,
      warrantyStartDate: parseDateOnly(dto.warrantyStartDate) ?? null,
      warrantyEndDate: parseDateOnly(dto.warrantyEndDate) ?? null,
    });

    const cost =
      dto.acquisitionCost != null ? new Prisma.Decimal(String(dto.acquisitionCost)) : null;

    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.companyAsset.create({
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
          warrantyLines: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { warrantyLines: true } },
        },
      });
      await createCompanyAssetWarrantyLinesTx(tx, tenantId, dto.companyId, asset.id, dto.warrantyLines);
      const full = await tx.companyAsset.findFirstOrThrow({
        where: { id: asset.id },
        include: {
          supplier: { select: { id: true, nameAr: true, nameEn: true } },
          invoice: { select: { id: true, invoiceNumber: true, supplierInvoiceNumber: true } },
          warrantyLines: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { warrantyLines: true } },
        },
      });
      return mapCompanyAssetRow(full);
    });
  }

  async completeFromInvoice(
    dto: CompleteCompanyAssetFromInvoiceDto,
    warrantyAttachmentFile?: Express.Multer.File,
  ) {
    const attachmentError = validateWarrantyAttachmentFile(warrantyAttachmentFile);
    if (attachmentError) {
      if (warrantyAttachmentFile?.path) await unlink(warrantyAttachmentFile.path).catch(() => {});
      throw new BadRequestException(attachmentError);
    }

    const tenantId = TenantContext.getTenantId();
    const nameAr = dto.nameAr?.trim();
    if (!nameAr) throw new BadRequestException('اسم الأصل مطلوب');

    const inv = await this.prisma.invoice.findFirst({
      where: {
        id: dto.invoiceId,
        companyId: dto.companyId,
        status: 'active',
        kind: { in: ['purchase', 'expense', 'fixed_expense'] },
      },
      include: { supplier: { select: { id: true, nameAr: true, nameEn: true } } },
    });
    if (!inv) throw new BadRequestException('الفاتورة غير موجودة أو ليست من نوع مشتريات/مصروف نشط');
    if (!inv.warrantyFollowUp) {
      throw new BadRequestException('لم يُفعّل «متابعة الضمان» لهذه الفاتورة عند الحفظ');
    }
    if (inv.warrantyFollowUpDone) {
      throw new BadRequestException('تم إكمال متابعة الضمان لهذه الفاتورة مسبقاً');
    }

    const purchaseDate = parseDateOnly(dto.purchaseDate) ?? inv.transactionDate;
    const w = computeWarrantyStorage({
      purchaseDate,
      warrantyMonths: dto.warrantyMonths ?? null,
      warrantyStartDate: parseDateOnly(dto.warrantyStartDate) ?? null,
      warrantyEndDate: parseDateOnly(dto.warrantyEndDate) ?? null,
    });
    if (!w.warrantyEndDate && (w.warrantyMonths == null || w.warrantyMonths === 0)) {
      throw new BadRequestException('حدد مدة الضمان (أشهر) أو تاريخ نهاية الضمان في قسم الضمان');
    }

    const cost =
      dto.acquisitionCost != null
        ? new Prisma.Decimal(String(dto.acquisitionCost))
        : inv.totalAmount;

    const markDone = dto.markInvoiceDone !== false;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const asset = await tx.companyAsset.create({
          data: {
            tenantId,
            companyId: dto.companyId,
            nameAr,
            nameEn: dto.nameEn?.trim() || null,
            serialNumber: dto.serialNumber?.trim() || null,
            location: dto.location?.trim() || null,
            purchaseDate,
            acquisitionCost: cost,
            supplierId: inv.supplierId,
            invoiceId: inv.id,
            warrantyDescription: dto.warrantyDescription?.trim() || null,
            warrantyMonths: w.warrantyMonths,
            warrantyStartDate: w.warrantyStartDate,
            warrantyEndDate: w.warrantyEndDate,
            warrantyAttachmentPath: warrantyAttachmentFile?.path ?? null,
            warrantyAttachmentOriginalName: warrantyAttachmentFile?.originalname
              ? warrantyAttachmentFile.originalname.trim().slice(0, 240)
              : null,
            warrantyAttachmentMime: warrantyAttachmentFile?.mimetype ?? null,
            notes: dto.notes?.trim() || null,
          },
        });
        await createCompanyAssetWarrantyLinesTx(tx, tenantId, dto.companyId, asset.id, dto.warrantyLines);
        if (markDone) {
          await tx.invoice.update({
            where: { id: inv.id },
            data: { warrantyFollowUpDone: true },
          });
        }
        const full = await tx.companyAsset.findFirstOrThrow({
          where: { id: asset.id },
          include: this.assetDetailInclude,
        });
        return mapCompanyAssetRow(full);
      });
    } catch (error) {
      if (warrantyAttachmentFile?.path) await unlink(warrantyAttachmentFile.path).catch(() => {});
      throw error;
    }
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

    const w = computeWarrantyStorage({
      purchaseDate,
      warrantyMonths,
      warrantyStartDate,
      warrantyEndDate,
    });

    const cost =
      dto.acquisitionCost !== undefined
        ? new Prisma.Decimal(String(dto.acquisitionCost))
        : existing.acquisitionCost;

    const tenantId = TenantContext.getTenantId();

    return this.prisma.$transaction(async (tx) => {
      await tx.companyAsset.update({
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
      });

      if (dto.warrantyLines !== undefined) {
        await tx.companyAssetWarrantyLine.deleteMany({ where: { companyAssetId: id } });
        await createCompanyAssetWarrantyLinesTx(tx, tenantId, companyId, id, dto.warrantyLines);
      }

      const full = await tx.companyAsset.findFirstOrThrow({
        where: { id },
        include: {
          supplier: { select: { id: true, nameAr: true, nameEn: true } },
          invoice: { select: { id: true, invoiceNumber: true, supplierInvoiceNumber: true } },
          warrantyLines: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { warrantyLines: true } },
        },
      });
      return mapCompanyAssetRow(full);
    });
  }

  async remove(id: string, companyId: string) {
    const existing = await this.prisma.companyAsset.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('الأصل غير موجود');
    await this.prisma.companyAsset.delete({ where: { id } });
    return { ok: true };
  }
}

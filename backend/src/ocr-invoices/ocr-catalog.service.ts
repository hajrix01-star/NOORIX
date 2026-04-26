/**
 * كتالوج OCR: مورّدون، أصناف، دمج/تكرار، تاريخ أسعار.
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOcrSupplierDto } from './dto/create-ocr-supplier.dto';
import { CreateOcrItemDto } from './dto/create-ocr-item.dto';
import { findBestItemMatch, normalizeItemForSearch } from './ocr-item-name-match.util';

@Injectable()
export class OcrCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Suppliers CRUD ───────────────────────────────────────────────────────

  async getSuppliers(tenantId: string, companyId: string) {
    if (!tenantId || !companyId) return [];
    return this.prisma.ocrSupplier.findMany({
      where: { tenantId, companyId },
      include: {
        aliases: true,
        _count: { select: { invoices: true } },
        accountingSupplier: { select: { id: true, nameAr: true, nameEn: true, taxNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSupplier(tenantId: string, companyId: string, dto: CreateOcrSupplierDto) {
    const { accountingSupplierId, supplierCategory, ...rest } = dto as CreateOcrSupplierDto & {
      accountingSupplierId?: string | null;
      supplierCategory?: string | null;
    };
    let accId: string | null = null;
    if (accountingSupplierId?.trim()) {
      const acc = await this.prisma.supplier.findFirst({
        where: { id: accountingSupplierId.trim(), tenantId, companyId, isDeleted: false },
      });
      if (!acc) throw new BadRequestException('مورد المحاسبة غير موجود أو لا يخص هذه الشركة.');
      accId = acc.id;
    }
    const cat =
      supplierCategory != null && String(supplierCategory).trim()
        ? String(supplierCategory).trim().slice(0, 64)
        : null;
    return this.prisma.ocrSupplier.create({
      data: {
        tenantId,
        companyId,
        ...rest,
        supplierCategory: cat,
        accountingSupplierId: accId,
      },
    });
  }

  async updateSupplier(tenantId: string, companyId: string, id: string, dto: Partial<CreateOcrSupplierDto>) {
    const row = await this.prisma.ocrSupplier.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('المورد غير موجود.');
    const data: Prisma.OcrSupplierUpdateInput = {};
    if (dto.nameAr !== undefined) data.nameAr = dto.nameAr;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.taxNumber !== undefined) data.taxNumber = dto.taxNumber;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.supplierCategory !== undefined) {
      const c = dto.supplierCategory;
      data.supplierCategory = c == null || c === '' ? null : String(c).trim().slice(0, 64);
    }
    if (dto.accountingSupplierId !== undefined) {
      const v = dto.accountingSupplierId;
      if (v == null || v === '') {
        data.accountingSupplier = { disconnect: true };
      } else {
        const acc = await this.prisma.supplier.findFirst({
          where: { id: v, tenantId, companyId, isDeleted: false },
        });
        if (!acc) throw new BadRequestException('مورد المحاسبة غير موجود أو لا يخص هذه الشركة.');
        data.accountingSupplier = { connect: { id: acc.id } };
      }
    }
    return this.prisma.ocrSupplier.update({
      where: { id },
      data,
      include: {
        aliases: true,
        _count: { select: { invoices: true } },
        accountingSupplier: { select: { id: true, nameAr: true, nameEn: true, taxNumber: true } },
      },
    });
  }

  async deleteSupplier(tenantId: string, companyId: string, id: string) {
    const row = await this.prisma.ocrSupplier.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('المورد غير موجود.');
    return this.prisma.ocrSupplier.delete({ where: { id } });
  }

  // ─── Items CRUD ───────────────────────────────────────────────────────────

  async getItems(tenantId: string, companyId: string) {
    if (!tenantId || !companyId) return [];
    return this.prisma.ocrItem.findMany({
      where: { tenantId, companyId },
      include: { aliases: true, _count: { select: { priceHistory: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createItem(tenantId: string, companyId: string, dto: CreateOcrItemDto) {
    return this.prisma.ocrItem.create({
      data: { tenantId, companyId, ...dto },
    });
  }

  async updateItem(tenantId: string, companyId: string, id: string, dto: Partial<CreateOcrItemDto>) {
    const row = await this.prisma.ocrItem.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('الصنف غير موجود.');
    return this.prisma.ocrItem.update({
      where: { id },
      data: dto,
    });
  }

  async deleteItem(tenantId: string, companyId: string, id: string) {
    const row = await this.prisma.ocrItem.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('الصنف غير موجود.');
    return this.prisma.ocrItem.delete({ where: { id } });
  }

  /**
   * يبحث عن أصناف مكررة (تشابه ≥ 0.78 بعد التطبيع الذكي).
   * يُرجع مجموعات الأصناف المتشابهة مع درجة التشابه.
   */
  async findDuplicateItems(tenantId: string, companyId: string) {
    if (!tenantId || !companyId) return [];
    const items = await this.prisma.ocrItem.findMany({
      where: { tenantId, companyId },
      include: { aliases: true, _count: { select: { priceHistory: true, lines: true } } },
    });

    const groups: Array<{
      items: typeof items;
      score: number;
    }> = [];

    const visited = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      if (visited.has(items[i].id)) continue;
      const group = [items[i]];
      const { ar: iAr, en: iEn } = normalizeItemForSearch(items[i].nameAr);
      const iSearch = iAr || iEn || items[i].nameAr;

      for (let j = i + 1; j < items.length; j++) {
        if (visited.has(items[j].id)) continue;
        const matchJ = findBestItemMatch(iSearch, [items[j]]);
        if (matchJ && matchJ.score >= 0.78) {
          group.push(items[j]);
          visited.add(items[j].id);
        }
      }

      if (group.length > 1) {
        // أعلى score بين أي زوج
        const score = findBestItemMatch(iSearch, group.slice(1))?.score ?? 0;
        groups.push({ items: group, score });
        group.forEach((g) => visited.add(g.id));
      }
    }

    return groups.sort((a, b) => b.score - a.score);
  }

  /**
   * يدمج صنفَين — يُبقي على الـ canonical (الأساسي) وينقل كل البيانات من المكرر إليه ثم يحذف المكرر.
   */
  async mergeItems(tenantId: string, companyId: string, keepId: string, mergeId: string) {
    if (keepId === mergeId) throw new Error('Cannot merge item with itself');

    const [keep, dup] = await Promise.all([
      this.prisma.ocrItem.findFirst({ where: { id: keepId, tenantId, companyId } }),
      this.prisma.ocrItem.findFirst({ where: { id: mergeId, tenantId, companyId } }),
    ]);
    if (!keep || !dup) throw new Error('Item not found');

    await this.prisma.$transaction([
      // نقل سطور الفواتير
      this.prisma.ocrInvoiceLine.updateMany({ where: { itemId: mergeId }, data: { itemId: keepId } }),
      // نقل تاريخ الأسعار
      this.prisma.ocrPriceHistory.updateMany({ where: { itemId: mergeId }, data: { itemId: keepId } }),
      // نقل الأسماء البديلة (aliases) — بإضافة اسم المكرر كـ alias
      this.prisma.ocrItemAlias.createMany({
        data: [
          { itemId: keepId, alias: dup.nameAr, language: 'ar', addedBy: 'merge' },
          ...(dup.nameEn ? [{ itemId: keepId, alias: dup.nameEn, language: 'en', addedBy: 'merge' }] : []),
        ],
        skipDuplicates: true,
      }),
      // تحديث hasSizes إذا كان المكرر له أحجام
      ...(dup.hasSizes ? [this.prisma.ocrItem.update({ where: { id: keepId }, data: { hasSizes: true } })] : []),
      // حذف الصنف المكرر
      this.prisma.ocrItem.delete({ where: { id: mergeId } }),
    ]);

    return { merged: mergeId, into: keepId };
  }

  async getItemPriceHistory(tenantId: string, companyId: string, itemId: string) {
    const item = await this.prisma.ocrItem.findFirst({ where: { id: itemId, tenantId, companyId } });
    if (!item) throw new NotFoundException('الصنف غير موجود.');
    return this.prisma.ocrPriceHistory.findMany({
      where: { tenantId, companyId, itemId },
      include: { supplier: { select: { id: true, nameAr: true } } },
      orderBy: { invoiceDate: 'desc' },
    });
  }


  // ─── Aliases ──────────────────────────────────────────────────────────────

  async addSupplierAlias(tenantId: string, companyId: string, supplierId: string, alias: string, language = 'ar') {
    const sup = await this.prisma.ocrSupplier.findFirst({ where: { id: supplierId, tenantId, companyId } });
    if (!sup) throw new NotFoundException('المورد غير موجود.');
    return this.prisma.ocrSupplierAlias.create({
      data: { supplierId, alias, language, addedBy: 'support' },
    });
  }

  async addItemAlias(tenantId: string, companyId: string, itemId: string, alias: string, language = 'ar') {
    const it = await this.prisma.ocrItem.findFirst({ where: { id: itemId, tenantId, companyId } });
    if (!it) throw new NotFoundException('الصنف غير موجود.');
    return this.prisma.ocrItemAlias.create({
      data: { itemId, alias, language, addedBy: 'support' },
    });
  }
}

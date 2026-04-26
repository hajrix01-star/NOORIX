/**
 * قراءة فواتير OCR + اقتراحات موردي المحاسبة
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OcrInvoiceWorkflowReaderService {
  constructor(private readonly prisma: PrismaService) {}

  async getInvoices(tenantId: string, companyId: string) {
    if (!tenantId || !companyId) return [];
    return this.prisma.ocrInvoice.findMany({
      where: { tenantId, companyId },
      include: {
        supplier: { select: { id: true, nameAr: true } },
        lines: { include: { item: { select: { id: true, nameAr: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoiceById(tenantId: string, companyId: string, id: string) {
    const inv = await this.prisma.ocrInvoice.findFirst({
      where: { id, tenantId, companyId },
      include: {
        supplier: { select: { id: true, nameAr: true, taxNumber: true } },
        lines: { include: { item: { select: { id: true, nameAr: true } } } },
        submittedBy: { select: { id: true, nameAr: true, email: true } },
        linkedPurchaseInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            transactionDate: true,
            kind: true,
          },
        },
      },
    });
    if (!inv) throw new NotFoundException('الفاتورة غير موجودة.');
    return inv;
  }

  /**
   * اقتراح موردي المحاسبة لمطابقة مورد OCR (اسم / الرقم الضريبي).
   * يدعم `q` مع `ocrSupplierId` معاً.
   * إن وُجد `accountingSupplierId` على مورد OCR يُعاد ذلك المورد أولاً.
   */
  async getAccountingSupplierSuggestions(
    tenantId: string,
    companyId: string,
    opts: { ocrSupplierId?: string; q?: string; invoiceVat?: string; limit?: number },
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 16, 1), 50);
    const qTrim = (opts.q || '').trim();
    let needleAr = qTrim;
    let needleEn = '';
    const invVatDigits = (opts.invoiceVat || '').replace(/\D/g, '');
    let taxDigits: string | null = invVatDigits.length >= 9 ? invVatDigits : null;
    let linkedAccountingId: string | null = null;
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    if (opts.ocrSupplierId) {
      const o = await this.prisma.ocrSupplier.findFirst({
        where: { id: opts.ocrSupplierId, tenantId, companyId },
        select: {
          nameAr: true,
          nameEn: true,
          taxNumber: true,
          accountingSupplierId: true,
        },
      });
      if (o) {
        linkedAccountingId = o.accountingSupplierId || null;
        const catAr = (o.nameAr || '').trim();
        const catEn = (o.nameEn || '').trim();
        if (!needleAr) needleAr = catAr;
        else if (catAr) needleAr = `${needleAr} ${catAr}`.trim();
        needleEn = catEn;
        const raw = o.taxNumber?.replace(/\D/g, '') || '';
        const ocrTax = raw.length >= 9 ? raw : null;
        if (!taxDigits && ocrTax) taxDigits = ocrTax;
      }
    }
    const na = norm(needleAr);
    const ne = norm(needleEn);
    const tokens = na.split(' ').filter((t) => t.length >= 2);

    if (!na && !ne && !taxDigits) {
      if (linkedAccountingId) {
        const lone = await this.prisma.supplier.findFirst({
          where: { id: linkedAccountingId, tenantId, companyId, isDeleted: false },
          select: { id: true, nameAr: true, nameEn: true, taxNumber: true },
        });
        return lone
          ? [{ ...lone, matchScore: 10000, linkedFromOcr: true as const }]
          : [];
      }
      return [];
    }

    const suppliers = await this.prisma.supplier.findMany({
      where: { tenantId, companyId, isDeleted: false },
      select: { id: true, nameAr: true, nameEn: true, taxNumber: true },
      take: 600,
    });

    const scored = suppliers.map((s) => {
      let score = 0;
      const ar = norm(s.nameAr);
      const en = s.nameEn ? norm(s.nameEn) : '';
      const stax = s.taxNumber?.replace(/\D/g, '') || '';
      if (taxDigits && stax && stax === taxDigits) score += 120;
      if (na && ar === na) score += 80;
      else if (na.length >= 2 && ar.includes(na)) score += 50;
      else if (na.length >= 2 && na.includes(ar) && ar.length >= 3) score += 42;
      else if (na.length >= 2 && ar.includes(na.slice(0, Math.min(12, na.length)))) score += 28;
      if (ne.length >= 2 && en.includes(ne)) score += 35;
      else if (ne.length >= 2 && ne.includes(en) && en.length >= 3) score += 22;
      for (const tok of tokens) {
        if (tok.length >= 2 && ar.includes(tok)) score += 12;
        if (tok.length >= 2 && en.includes(tok)) score += 10;
      }
      return { id: s.id, nameAr: s.nameAr, nameEn: s.nameEn, taxNumber: s.taxNumber, score };
    });

    let list = scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ score, ...rest }) => ({ ...rest, matchScore: score }));

    if (list.length < limit && na.length >= 2) {
      const prefix = na.slice(0, Math.min(8, na.length));
      const extra = await this.prisma.supplier.findMany({
        where: {
          tenantId,
          companyId,
          isDeleted: false,
          OR: [
            { nameAr: { contains: prefix, mode: 'insensitive' } },
            { nameEn: { contains: prefix, mode: 'insensitive' } },
          ],
          NOT: { id: { in: list.map((x) => x.id) } },
        },
        select: { id: true, nameAr: true, nameEn: true, taxNumber: true },
        take: limit - list.length,
      });
      list = [
        ...list,
        ...extra.map((s) => ({
          id: s.id,
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          taxNumber: s.taxNumber,
          matchScore: 5,
        })),
      ];
    }

    if (linkedAccountingId) {
      const linked = suppliers.find((s) => s.id === linkedAccountingId);
      if (linked) {
        const rest = list.filter((x) => x.id !== linked.id);
        list = [
          {
            id: linked.id,
            nameAr: linked.nameAr,
            nameEn: linked.nameEn,
            taxNumber: linked.taxNumber,
            matchScore: 10000,
            linkedFromOcr: true as boolean,
          } as (typeof list)[number],
          ...rest,
        ];
      }
    }

    return list.slice(0, limit);
  }
}

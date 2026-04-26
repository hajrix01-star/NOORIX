/**
 * تنبيهات الأسعار (مقارنة بتاريخ) + قواعد التصحيح
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OcrInvoiceWorkflowInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPriceAlerts(tenantId: string, companyId: string) {
    if (!tenantId || !companyId) return [];
    const history = await this.prisma.ocrPriceHistory.findMany({
      where: { tenantId, companyId },
      include: {
        item: { select: { id: true, nameAr: true, category: true } },
        supplier: { select: { id: true, nameAr: true } },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    const byItem = new Map<string, typeof history>();
    for (const h of history) {
      if (!byItem.has(h.itemId)) byItem.set(h.itemId, []);
      byItem.get(h.itemId)!.push(h);
    }

    const alerts: Array<{
      itemId: string;
      itemName: string;
      category: string | null;
      latestPrice: number;
      latestSupplier: string;
      latestInvoiceId: string | null;
      latestInvoiceDate: Date;
      lowestPrice: number;
      lowestSupplier: string;
      lowestInvoiceId: string | null;
      lowestInvoiceDate: Date;
      averagePrice: number;
      priceIncreasePercent: number;
    }> = [];

    for (const [, entries] of byItem) {
      if (entries.length < 2) continue;
      const latest = entries[0];
      const latestPrice = Number(latest.price);
      const allPrices = entries.map((e) => Number(e.price));
      const lowestPrice = Math.min(...allPrices);
      const lowestEntry = entries.find((e) => Number(e.price) === lowestPrice)!;
      const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;

      const VAT_RATE = 0.15;
      const isVatArtifact =
        Math.abs(latestPrice / lowestPrice - (1 + VAT_RATE)) / (1 + VAT_RATE) < 0.02 ||
        Math.abs(lowestPrice / latestPrice - (1 + VAT_RATE)) / (1 + VAT_RATE) < 0.02;

      if (latestPrice > lowestPrice * 1.05 && !isVatArtifact) {
        alerts.push({
          itemId: latest.itemId,
          itemName: latest.item.nameAr,
          category: latest.item.category,
          latestPrice,
          latestSupplier: latest.supplier.nameAr,
          latestInvoiceId: latest.invoiceId ?? null,
          latestInvoiceDate: latest.invoiceDate,
          lowestPrice,
          lowestSupplier: lowestEntry.supplier.nameAr,
          lowestInvoiceId: lowestEntry.invoiceId ?? null,
          lowestInvoiceDate: lowestEntry.invoiceDate,
          averagePrice: Math.round(avgPrice * 100) / 100,
          priceIncreasePercent: Math.round(((latestPrice - lowestPrice) / lowestPrice) * 100),
        });
      }
    }

    return alerts.sort((a, b) => b.priceIncreasePercent - a.priceIncreasePercent);
  }

  async getCorrectionRules(tenantId: string, companyId: string) {
    return this.prisma.ocrCorrectionRule.findMany({
      where: { tenantId, companyId },
      include: { supplier: { select: { id: true, nameAr: true } } },
      orderBy: { occurrences: 'desc' },
    });
  }

  async updateCorrectionRule(tenantId: string, companyId: string, id: string, status: string) {
    const row = await this.prisma.ocrCorrectionRule.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('القاعدة غير موجودة.');
    return this.prisma.ocrCorrectionRule.update({
      where: { id },
      data: { status },
    });
  }
}

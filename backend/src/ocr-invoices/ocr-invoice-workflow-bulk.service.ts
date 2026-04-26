/**
 * تأكيد حالة فاتورة + حذف جماعي
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OcrInvoiceWorkflowBulkService {
  constructor(private readonly prisma: PrismaService) {}

  async confirmInvoice(tenantId: string, companyId: string, id: string, status: string) {
    const row = await this.prisma.ocrInvoice.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('الفاتورة غير موجودة.');
    return this.prisma.ocrInvoice.update({
      where: { id },
      data: { status },
    });
  }

  async bulkDeleteInvoices(tenantId: string, companyId: string, ids: string[]) {
    if (!ids?.length) return { count: 0 };
    const result = await this.prisma.ocrInvoice.deleteMany({
      where: { id: { in: ids }, tenantId, companyId },
    });
    return { count: result.count };
  }

  async bulkDeleteSuppliers(tenantId: string, companyId: string, ids: string[]) {
    if (!ids?.length) return { count: 0 };
    const result = await this.prisma.ocrSupplier.deleteMany({
      where: { id: { in: ids }, tenantId, companyId },
    });
    return { count: result.count };
  }

  async bulkDeleteItems(tenantId: string, companyId: string, ids: string[]) {
    if (!ids?.length) return { count: 0 };
    const result = await this.prisma.ocrItem.deleteMany({
      where: { id: { in: ids }, tenantId, companyId },
    });
    return { count: result.count };
  }

  async bulkDeletePriceHistory(tenantId: string, companyId: string, itemIds: string[]) {
    if (!itemIds?.length) return { count: 0 };
    const result = await this.prisma.ocrPriceHistory.deleteMany({
      where: { itemId: { in: itemIds }, tenantId, companyId },
    });
    return { count: result.count };
  }
}

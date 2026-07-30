import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { OrdersStaffReportService } from './orders-staff-report.service';
import { OrdersStaffService } from './orders-staff.service';

describe('OrdersStaffService direct operational orders', () => {
  it('saves a section order as sent and returns WhatsApp text without an approval step', async () => {
    const now = new Date('2026-07-30T18:00:00.000Z');
    const product = {
      id: 'product-1',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      categoryId: null,
      nameAr: 'طماطم',
      nameEn: 'Tomato',
      lastPrice: new Prisma.Decimal(5),
      variants: null,
      unit: 'kg',
      sizes: null,
      packaging: null,
      sections: ['مطبخ'],
      sectionIds: [],
      productType: 'order',
      isActive: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    const savedOrder = {
      id: 'staff-order-1',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      userId: 'user-1',
      sectionName: 'مطبخ',
      orderType: 'order',
      status: 'sent',
      sentAt: now,
      createdAt: now,
      updatedAt: now,
      notes: null,
      logRef: null,
      saleDate: null,
      purchaseOrderId: null,
      items: [{
        id: 'staff-item-1',
        staffOrderId: 'staff-order-1',
        productId: product.id,
        quantity: new Prisma.Decimal(2),
        quantityMultiplier: new Prisma.Decimal(1),
        size: null,
        packaging: null,
        unit: 'kg',
        unitPrice: new Prisma.Decimal(5),
        notes: null,
        createdAt: now,
        product,
      }],
      user: { nameAr: 'مدير المطعم', nameEn: null },
    };
    const prisma = new TenantPrismaService();
    jest.spyOn(prisma.orderProduct, 'findMany').mockResolvedValue([product]);
    const createSpy = jest.spyOn(prisma.staffOrder, 'create').mockResolvedValue(savedOrder);
    const service = new OrdersStaffService(prisma, new OrdersStaffReportService(prisma));

    let resultPromise: ReturnType<OrdersStaffService['createStaffOrder']> | undefined;
    TenantContext.run('tenant-1', 'user-1', () => {
      resultPromise = service.createStaffOrder('user-1', {
        companyId: 'company-1',
        sectionName: 'مطبخ',
        orderType: 'order',
        lang: 'en',
        items: [{ productId: product.id, quantity: '2', unit: 'kg' }],
      });
    });
    const result = await resultPromise!;

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orderType: 'order',
        status: 'sent',
        sentAt: expect.any(Date),
      }),
    }));
    expect(createSpy.mock.calls[0][0].data).not.toHaveProperty('purchaseOrderId');
    expect(result).toEqual(expect.objectContaining({
      id: 'staff-order-1',
      status: 'sent',
      whatsAppText: expect.stringContaining('Purchase list'),
    }));
    expect(result.whatsAppText).toContain('Tomato');
  });
});

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
      recipe: null,
      inventoryConversions: null,
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
      entryType: 'issue',
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
        cancellationReasons: null,
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
      }, 'staff', ['ORDERS_STAFF_SUBMIT']);
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

  it('stores an internal cancellation as a negative immutable movement with line reasons', async () => {
    const now = new Date('2026-07-30T18:00:00.000Z');
    const saleDate = new Date('2026-07-30T00:00:00.000Z');
    const product = {
      id: 'juice-1',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      categoryId: null,
      nameAr: 'عصير برتقال',
      nameEn: 'Orange juice',
      lastPrice: new Prisma.Decimal(12),
      variants: null,
      recipe: null,
      inventoryConversions: null,
      unit: 'piece',
      sizes: null,
      packaging: null,
      sections: ['بار'],
      sectionIds: [],
      productType: 'sale',
      isActive: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    const prisma = new TenantPrismaService();
    jest.spyOn(prisma.orderProduct, 'findMany').mockResolvedValue([product]);
    jest.spyOn(prisma.staffOrder, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.staffOrderItem, 'findMany').mockResolvedValue([{
      id: 'recorded-item-1',
      staffOrderId: 'recorded-order-1',
      productId: product.id,
      quantity: new Prisma.Decimal(3),
      quantityMultiplier: new Prisma.Decimal(1),
      size: null,
      packaging: null,
      unit: 'piece',
      unitPrice: new Prisma.Decimal(12),
      notes: null,
      cancellationReasons: null,
      createdAt: now,
    }]);
    const savedCancellation = {
      id: 'cancel-1',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      userId: 'user-1',
      sectionName: 'بار',
      orderType: 'sale',
      entryType: 'cancellation',
      status: 'sent',
      saleDate,
      logRef: 'L-260730-001',
      notes: null,
      sentAt: now,
      purchaseOrderId: null,
      createdAt: now,
      updatedAt: now,
      items: [{
        id: 'cancel-item-1',
        staffOrderId: 'cancel-1',
        productId: product.id,
        quantity: new Prisma.Decimal(-1),
        quantityMultiplier: new Prisma.Decimal(1),
        size: null,
        packaging: null,
        unit: 'piece',
        unitPrice: new Prisma.Decimal(12),
        notes: null,
        cancellationReasons: ['customer_disliked', 'replaced_item'],
        createdAt: now,
        product,
      }],
      user: { nameAr: 'موظف البار', nameEn: null },
    };
    const createSpy = jest.spyOn(prisma.staffOrder, 'create').mockResolvedValue(savedCancellation);
    const service = new OrdersStaffService(prisma, new OrdersStaffReportService(prisma));

    let resultPromise: ReturnType<OrdersStaffService['createStaffOrder']> | undefined;
    TenantContext.run('tenant-1', 'user-1', () => {
      resultPromise = service.createStaffOrder('user-1', {
        companyId: 'company-1',
        sectionName: 'بار',
        orderType: 'sale',
        entryType: 'cancellation',
        saleDate: '2026-07-30',
        items: [{
          productId: product.id,
          quantity: '1',
          unit: 'piece',
          cancellationReasons: ['customer_disliked', 'replaced_item'],
        }],
      }, 'staff', ['STAFF_ORDERS_SUBMIT']);
    });
    await resultPromise!;

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        entryType: 'cancellation',
        items: {
          create: [expect.objectContaining({
            productId: product.id,
            quantity: new Prisma.Decimal(-1),
            cancellationReasons: ['customer_disliked', 'replaced_item'],
          })],
        },
      }),
    }));
  });

  it('rejects cancelling more than the recorded net quantity', async () => {
    const now = new Date('2026-07-30T18:00:00.000Z');
    const product = {
      id: 'juice-1',
      tenantId: 'tenant-1',
      companyId: 'company-1',
      categoryId: null,
      nameAr: 'عصير برتقال',
      nameEn: 'Orange juice',
      lastPrice: new Prisma.Decimal(12),
      variants: null,
      recipe: null,
      inventoryConversions: null,
      unit: 'piece',
      sizes: null,
      packaging: null,
      sections: ['بار'],
      sectionIds: [],
      productType: 'sale',
      isActive: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    const prisma = new TenantPrismaService();
    jest.spyOn(prisma.orderProduct, 'findMany').mockResolvedValue([product]);
    jest.spyOn(prisma.staffOrder, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.staffOrderItem, 'findMany').mockResolvedValue([{
      id: 'recorded-item-1',
      staffOrderId: 'recorded-order-1',
      productId: product.id,
      quantity: new Prisma.Decimal(1),
      quantityMultiplier: new Prisma.Decimal(1),
      size: null,
      packaging: null,
      unit: 'piece',
      unitPrice: new Prisma.Decimal(12),
      notes: null,
      cancellationReasons: null,
      createdAt: now,
    }]);
    const createSpy = jest.spyOn(prisma.staffOrder, 'create');
    const service = new OrdersStaffService(prisma, new OrdersStaffReportService(prisma));

    let resultPromise: ReturnType<OrdersStaffService['createStaffOrder']> | undefined;
    TenantContext.run('tenant-1', 'user-1', () => {
      resultPromise = service.createStaffOrder('user-1', {
        companyId: 'company-1',
        sectionName: 'بار',
        orderType: 'sale',
        entryType: 'cancellation',
        saleDate: '2026-07-30',
        items: [{
          productId: product.id,
          quantity: '2',
          unit: 'piece',
          cancellationReasons: ['customer_disliked'],
        }],
      }, 'staff', ['STAFF_ORDERS_SUBMIT']);
    });

    await expect(resultPromise!).rejects.toThrow('كمية الإلغاء');
    expect(createSpy).not.toHaveBeenCalled();
  });
});

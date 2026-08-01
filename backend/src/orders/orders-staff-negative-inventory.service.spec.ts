import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { OrdersInventoryService } from './orders-inventory.service';
import { OrdersStaffReportService } from './orders-staff-report.service';
import {
  NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED,
  OrdersStaffService,
} from './orders-staff.service';

function fixture() {
  const now = new Date('2026-08-01T12:00:00.000Z');
  const saleProduct = {
    id: 'sale-1',
    nameAr: 'منتج بيع',
    nameEn: 'Sale product',
    unit: 'piece',
    variants: null,
    inventoryConversions: null,
    conversionTemplate: null,
    recipe: [{ materialProductId: 'material-1', quantity: '1', unit: 'piece' }],
    productType: 'sale',
    lastPrice: new Prisma.Decimal(10),
  };
  const material = {
    id: 'material-1',
    nameAr: 'مادة',
    nameEn: 'Material',
    unit: 'piece',
    variants: null,
    inventoryConversions: null,
    conversionTemplate: null,
    recipe: null,
    productType: 'order',
  };
  const create = jest.fn().mockImplementation(async ({ data }) => ({
    id: 'staff-order-1',
    ...data,
    createdAt: now,
    updatedAt: now,
    items: data.items.create.map((item: Record<string, unknown>) => ({
      ...item,
      product: saleProduct,
    })),
    user: { nameAr: 'مالك', nameEn: 'Owner' },
  }));
  const tx = {
    $queryRaw: jest.fn(),
    inventoryMovement: { groupBy: jest.fn() },
    orderProduct: {
      findMany: jest.fn()
        .mockResolvedValueOnce([saleProduct])
        .mockResolvedValueOnce([material]),
    },
    staffOrder: {
      findMany: jest.fn().mockResolvedValue([]),
      create,
    },
    staffOrderItem: { findMany: jest.fn() },
  };
  const prisma = Object.assign(
    Object.create(TenantPrismaService.prototype) as TenantPrismaService,
    { withTenant: jest.fn((callback) => callback(tx)) },
  );
  const inventory = Object.assign(
    Object.create(OrdersInventoryService.prototype) as OrdersInventoryService,
    {
      lockInventoryBalance: jest.fn().mockResolvedValue(undefined),
      findStaffSaleNegativeInventory: jest.fn().mockResolvedValue([{
        productId: 'material-1',
        productNameAr: 'مادة',
        productNameEn: 'Material',
        unit: 'piece',
        availableQuantity: '0',
        requestedQuantity: '1',
        projectedQuantity: '-1',
      }]),
    },
  );
  const service = new OrdersStaffService(
    prisma,
    {} as OrdersStaffReportService,
    inventory,
  );
  const dto = {
    companyId: 'company-1',
    sectionName: 'المطبخ',
    orderType: 'sale',
    entryType: 'issue' as const,
    saleDate: '2026-08-01',
    items: [{ productId: 'sale-1', quantity: '1', unit: 'piece' }],
  };
  return { service, prisma, inventory, tx, create, dto };
}

describe('OrdersStaffService negative inventory policy', () => {
  beforeEach(() => jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1'));
  afterEach(() => jest.restoreAllMocks());

  it('rejects negative inventory by default and does not write the staff order', async () => {
    const { service, create, dto } = fixture();

    let caught: unknown;
    try {
      await service.createStaffOrder('user-1', dto, 'owner');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConflictException);
    expect((caught as ConflictException).getResponse()).toMatchObject({
      errorCode: NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED,
      details: { canOverride: true },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('allows an owner retry with the explicit override inside the locked transaction', async () => {
    const { service, inventory, create, dto } = fixture();

    await expect(service.createStaffOrder('user-1', {
      ...dto,
      allowNegativeInventory: true,
    }, 'owner')).resolves.toMatchObject({ id: 'staff-order-1' });
    expect(inventory.lockInventoryBalance).toHaveBeenCalledWith(expect.anything(), 'tenant-1', 'company-1');
    expect(inventory.findStaffSaleNegativeInventory).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rejects a forged override from a non-privileged staff user before opening a transaction', async () => {
    const { service, prisma, dto } = fixture();

    await expect(service.createStaffOrder('user-1', {
      ...dto,
      allowNegativeInventory: true,
    }, 'staff', ['STAFF_ORDERS_SUBMIT'])).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.withTenant).not.toHaveBeenCalled();
  });
});

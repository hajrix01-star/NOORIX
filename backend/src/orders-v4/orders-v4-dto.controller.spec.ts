import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PERMISSIONS } from '../auth/constants/permissions';
import type { JwtUser } from '../auth/decorators/current-user.decorator';
import { OrdersV4Controller } from './orders-v4.controller';
import {
  OrdersV4ActivityReportQueryDto,
  OrdersV4DateRangeQueryDto,
  OrdersV4DocumentDto,
  OrdersV4DocumentPreviewDto,
  OrdersV4DocumentsQueryDto,
  OrdersV4ItemsReportQueryDto,
  OrdersV4LedgerQueryDto,
  OrdersV4LimitQueryDto,
  OrdersV4StocktakeDto,
} from './orders-v4.dto';

describe('Orders V4 runtime DTO validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

  it('exposes concrete DTO metadata to Nest instead of erased Object contracts', () => {
    const documentTypes = Reflect.getMetadata('design:paramtypes', OrdersV4Controller.prototype, 'createDocument');
    const previewTypes = Reflect.getMetadata('design:paramtypes', OrdersV4Controller.prototype, 'previewPurchaseDocument');
    const stocktakeTypes = Reflect.getMetadata('design:paramtypes', OrdersV4Controller.prototype, 'createStocktake');
    expect(documentTypes[1]).toBe(OrdersV4DocumentDto);
    expect(previewTypes[1]).toBe(OrdersV4DocumentPreviewDto);
    expect(stocktakeTypes[1]).toBe(OrdersV4StocktakeDto);
  });

  it('rejects unknown fields and negative composite stocktake quantities', async () => {
    const base = {
      stocktakeDate: '2026-08-03', locationId: 'main', idempotencyKey: 'stocktake-1',
      lines: [{ itemId: 'item-1', physicalUnits: [{ unitId: 'carton', quantity: '2' }] }],
    };
    await expect(pipe.transform({ ...base, unexpected: true }, { type: 'body', metatype: OrdersV4StocktakeDto }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(pipe.transform({ ...base, lines: [{ itemId: 'item-1', physicalUnits: [{ unitId: 'carton', quantity: '-2' }] }] }, { type: 'body', metatype: OrdersV4StocktakeDto }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['documents', OrdersV4DocumentsQueryDto, { type: 'purchase', limit: '250' }],
    ['activity report', OrdersV4ActivityReportQueryDto, { type: 'purchase', sectionIds: 'bar,kitchen', categoryIds: 'cat-1' }],
    ['summary', OrdersV4DateRangeQueryDto, { startDate: '2026-08-01', endDate: '2026-08-31' }],
    ['items report', OrdersV4ItemsReportQueryDto, { type: 'registration' }],
    ['ledger', OrdersV4LedgerQueryDto, { limit: '250' }],
    ['stocktakes', OrdersV4LimitQueryDto, { limit: '100' }],
  ])('accepts the shared companyId transport for %s queries', async (_name, metatype, query) => {
    const transformed = await pipe.transform(
      { companyId: 'company-1', ...query },
      { type: 'query', metatype },
    ) as { companyId?: string };
    expect(transformed.companyId).toBe('company-1');
  });

  it('continues to reject unrelated query properties', async () => {
    await expect(pipe.transform(
      { companyId: 'company-1', unexpected: 'blocked' },
      { type: 'query', metatype: OrdersV4DateRangeQueryDto },
    )).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Orders V4 purchase edit permission consistency', () => {
  it('lets a WRITE-only user reopen and save a received-purchase correction as cashier access', () => {
    const documents = {
      receivePurchase: jest.fn().mockReturnValue({ id: 'purchase-1' }),
      reopenPurchase: jest.fn().mockReturnValue({ id: 'purchase-1', editMode: 'correction' }),
    };
    const controller = new OrdersV4Controller(
      {} as never,
      documents as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const writeOnlyUser: JwtUser = {
      sub: 'writer-1',
      email: 'writer@example.com',
      role: 'manager',
      companyIds: ['company-1'],
      permissions: [PERMISSIONS.ORDERS_V4_WRITE],
    };

    expect(() => controller.reopenPurchaseDocument(
      'company-1',
      'purchase-1',
      { idempotencyKey: 'reopen-1' },
      writeOnlyUser,
    )).not.toThrow();
    expect(() => controller.receivePurchase(
      'company-1',
      'purchase-1',
      { editMode: 'correction' } as never,
      writeOnlyUser,
    )).not.toThrow();

    expect(documents.reopenPurchase).toHaveBeenCalledWith('company-1', 'purchase-1', 'reopen-1', 'cashier');
    expect(documents.receivePurchase).toHaveBeenCalledWith('company-1', 'purchase-1', expect.objectContaining({ editMode: 'correction' }), 'cashier');
  });
});

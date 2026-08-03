import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { OrdersV4Controller } from './orders-v4.controller';
import { OrdersV4DocumentDto, OrdersV4StocktakeDto } from './orders-v4.dto';

describe('Orders V4 runtime DTO validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

  it('exposes concrete DTO metadata to Nest instead of erased Object contracts', () => {
    const documentTypes = Reflect.getMetadata('design:paramtypes', OrdersV4Controller.prototype, 'createDocument');
    const stocktakeTypes = Reflect.getMetadata('design:paramtypes', OrdersV4Controller.prototype, 'createStocktake');
    expect(documentTypes[1]).toBe(OrdersV4DocumentDto);
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
});

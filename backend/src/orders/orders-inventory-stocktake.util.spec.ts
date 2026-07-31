import {
  assertCurrentSaudiStocktakeDate,
  calculateStocktakeLines,
} from './orders-inventory-stocktake.util';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateInventoryStocktakeDto } from './dto/create-inventory-stocktake.dto';

describe('calculateStocktakeLines', () => {
  it('calculates positive and negative immutable adjustment quantities', () => {
    const rows = calculateStocktakeLines([
      { productId: 'a', unit: 'piece', expectedQuantity: '10', physicalQuantity: '12.5' },
      { productId: 'b', unit: 'g', expectedQuantity: '20', physicalQuantity: '17' },
    ]);

    expect(rows.map((row) => row.varianceQuantity.toString())).toEqual(['2.5', '-3']);
  });

  it('rejects duplicate products and negative physical stock', () => {
    expect(() => calculateStocktakeLines([
      { productId: 'a', unit: 'piece', expectedQuantity: '1', physicalQuantity: '1' },
      { productId: 'a', unit: 'piece', expectedQuantity: '1', physicalQuantity: '1' },
    ])).toThrow('Duplicate stocktake product');

    expect(() => calculateStocktakeLines([
      { productId: 'a', unit: 'piece', expectedQuantity: '1', physicalQuantity: '-1' },
    ])).toThrow('Invalid physical stock quantity');
  });

  it('accepts only the current Saudi date', () => {
    expect(assertCurrentSaudiStocktakeDate('2026-07-31', '2026-07-31')).toBe('2026-07-31');
    expect(() => assertCurrentSaudiStocktakeDate('2026-07-30', '2026-07-31')).toThrow('current Saudi date');
    expect(() => assertCurrentSaudiStocktakeDate('2026-07-31T00:00:00Z', '2026-07-31')).toThrow('current Saudi date');
  });

  it('rejects invalid ids and quantities outside DECIMAL(18,6)', () => {
    expect(() => calculateStocktakeLines([
      { productId: 'bad id', unit: 'piece', expectedQuantity: '1', physicalQuantity: '1' },
    ])).toThrow('product id is invalid');

    expect(() => calculateStocktakeLines([
      { productId: 'product-1', unit: 'piece', expectedQuantity: '1', physicalQuantity: '1.1234567' },
    ])).toThrow('precision');

    expect(() => calculateStocktakeLines([
      { productId: 'product-1', unit: 'piece', expectedQuantity: '1', physicalQuantity: '1000000000000' },
    ])).toThrow('precision');
  });

  it('enforces ids, date shape, nonnegative quantities, and six-decimal precision in the DTO', async () => {
    const dto = plainToInstance(CreateInventoryStocktakeDto, {
      stocktakeDate: '2026-07-31T00:00:00Z',
      lines: [
        { productId: '', physicalQuantity: '-1' },
        { productId: 'product-2', physicalQuantity: '1.1234567' },
      ],
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['stocktakeDate', 'lines']));
    expect(errors.find((error) => error.property === 'lines')?.children).toHaveLength(2);
  });

  it('rounds derived expected quantities to the database scale before calculating variance', () => {
    const [line] = calculateStocktakeLines([
      { productId: 'product-1', unit: 'piece', expectedQuantity: '1.12345678', physicalQuantity: '2' },
    ]);

    expect(line.expectedQuantity.toString()).toBe('1.123457');
    expect(line.varianceQuantity.toString()).toBe('0.876543');
  });
});

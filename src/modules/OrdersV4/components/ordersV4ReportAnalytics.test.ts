import { describe, expect, it } from 'vitest';
import type { OrdersV4Document } from '../../../types/api';
import {
  aggregateDocumentsByDay,
  aggregateDocumentsBySection,
  aggregateDailySalesBySection,
  aggregateItems,
  topItemsBySection,
} from './ordersV4ReportAnalytics';

function documentFixture(overrides: {
  id: string;
  date: string;
  sectionId: string;
  sectionName: string;
  type?: 'purchase' | 'registration';
  itemId?: string;
  itemName?: string;
  quantity: number;
  amount: number;
}): OrdersV4Document {
  const type = overrides.type ?? 'registration';
  return {
    id: overrides.id,
    documentNumber: overrides.id,
    documentType: type,
    registrationEntryType: 'issue',
    documentDate: overrides.date,
    status: 'received',
    revision: 1,
    createdAt: overrides.date,
    sectionId: overrides.sectionId,
    locationId: 'location-1',
    subtotal: String(overrides.amount),
    totalAmount: String(overrides.amount),
    operationalCost: String(overrides.amount),
    section: { id: overrides.sectionId, code: overrides.sectionId, nameAr: overrides.sectionName, isActive: true },
    location: { id: 'location-1', code: 'main', nameAr: 'الرئيسي', isActive: true },
    lines: [{
      id: `${overrides.id}-line`, lineNumber: 1, itemId: overrides.itemId ?? 'item-1', itemNameSnapshot: overrides.itemName ?? 'سكر',
      inputQuantity: String(overrides.quantity), inputUnitId: 'piece', baseQuantity: String(overrides.quantity), baseUnitId: 'piece',
      unitPrice: String(overrides.amount / overrides.quantity), priceUnitId: 'piece', priceQuantity: String(overrides.quantity),
      lineTotal: String(overrides.amount), operationalCost: String(overrides.amount),
      item: { id: overrides.itemId ?? 'item-1', code: 'I1', nameAr: overrides.itemName ?? 'سكر', categoryId: 'cat-1', inventoryUnitId: 'piece', isActive: true, category: { id: 'cat-1', nameAr: 'مواد', isActive: true }, inventoryUnit: { id: 'piece', code: 'piece', nameAr: 'حبة', unitKind: 'count', isActive: true } },
      inputUnit: { id: 'piece', code: 'piece', nameAr: 'حبة', unitKind: 'count', isActive: true },
      baseUnit: { id: 'piece', code: 'piece', nameAr: 'حبة', unitKind: 'count', isActive: true },
      priceUnit: { id: 'piece', code: 'piece', nameAr: 'حبة', unitKind: 'count', isActive: true },
    }],
  } as unknown as OrdersV4Document;
}

describe('orders V4 report analytics', () => {
  const documents = [
    documentFixture({ id: 'r1', date: '2026-08-01', sectionId: 'kitchen', sectionName: 'مطبخ', quantity: 10, amount: 25 }),
    documentFixture({ id: 'r2', date: '2026-08-02', sectionId: 'bar', sectionName: 'بار', quantity: 5, amount: 15 }),
    documentFixture({ id: 'r3', date: '2026-08-02', sectionId: 'kitchen', sectionName: 'مطبخ', quantity: 2, amount: 10 }),
  ];

  it('reconciles section and item totals from the same document snapshots', () => {
    const sections = aggregateDocumentsBySection(documents);
    const items = aggregateItems(documents);
    expect(sections.find((row) => row.id === 'kitchen')).toMatchObject({ documents: 2, quantity: 12, amount: 35 });
    expect(items[0]).toMatchObject({ documentCount: 3, baseQuantity: '17', totalAmount: '50' });
    expect(sections.reduce((sum, row) => sum + row.amount, 0)).toBe(50);
  });

  it('builds daily chart values for the selected metric', () => {
    const amount = aggregateDocumentsByDay(documents, 'amount');
    const quantity = aggregateDocumentsByDay(documents, 'quantity');
    expect(amount[1]['مطبخ']).toBe(10);
    expect(amount[1]['بار']).toBe(15);
    expect(quantity[1]['مطبخ']).toBe(2);
  });

  it('groups top items independently inside each section', () => {
    const groups = topItemsBySection(documents);
    expect(groups.map((row) => row.sectionName)).toEqual(['بار', 'مطبخ']);
    expect(groups.find((row) => row.sectionId === 'kitchen')?.items[0].totalAmount).toBe('35');
  });

  it('keeps sales revenue separate from operational cost', () => {
    const registration = documentFixture({ id: 'sale-1', date: '2026-08-03', sectionId: 'bar', sectionName: 'بار', quantity: 2, amount: 2_000 });
    registration.operationalCost = '0';
    registration.lines[0].operationalCost = '0';

    expect(aggregateDocumentsBySection([registration])[0].amount).toBe(2_000);
    expect(aggregateDocumentsBySection([registration], 'cost')[0].amount).toBe(0);
    expect(aggregateItems([registration])[0].totalAmount).toBe('2000');
    expect(aggregateItems([registration], 'cost')[0].totalAmount).toBe('0');
  });

  it('shows each day total and its department sales', () => {
    const rows = aggregateDailySalesBySection(documents);
    expect(rows[0]).toMatchObject({ date: '2026-08-02', amount: 25 });
    expect(rows[0].sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'bar', amount: 15 }),
      expect.objectContaining({ id: 'kitchen', amount: 10 }),
    ]));
  });
});

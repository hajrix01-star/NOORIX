import { describe, expect, it } from 'vitest';
import type { OrdersV4Document, OrdersV4Section } from '../../../types/api';
import {
  aggregateDocumentsByDay,
  aggregateDocumentsBySection,
  aggregateItems,
  findMissingRegistrationDays,
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

  it('detects missing active section days and ignores disabled sections', () => {
    const sections: OrdersV4Section[] = [
      { id: 'kitchen', code: 'kitchen', nameAr: 'مطبخ', isActive: true },
      { id: 'bar', code: 'bar', nameAr: 'بار', isActive: true },
      { id: 'old', code: 'old', nameAr: 'قديم', isActive: false },
    ];
    const missing = findMissingRegistrationDays(documents, sections, '2026-08-01', '2026-08-02');
    expect(missing).toEqual([{ date: '2026-08-01', sectionId: 'bar', sectionName: 'بار' }]);
  });
});

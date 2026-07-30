import { buildStaffSalesReportModel } from './orders-staff-sales-report-builder.util';

describe('buildStaffSalesReportModel', () => {
  it('aggregates staff sale orders by operation, product, section, user, and day', () => {
    const model = buildStaffSalesReportModel({
      orders: [
        {
          id: 'order-1',
          logRef: '29-06-2026-A',
          userId: 'user-1',
          sectionName: 'Kitchen',
          saleDate: new Date(Date.UTC(2026, 5, 29)),
          createdAt: new Date(Date.UTC(2026, 5, 29, 10)),
          items: [
            { productId: 'product-1', quantity: '2', unitPrice: '10', unit: 'piece' },
          ],
        },
        {
          id: 'order-2',
          logRef: '29-06-2026-A',
          userId: 'user-1',
          sectionName: 'Cafe',
          saleDate: new Date(Date.UTC(2026, 5, 29)),
          createdAt: new Date(Date.UTC(2026, 5, 29, 11)),
          items: [
            { productId: 'product-2', quantity: '3', unitPrice: '5', unit: 'cup' },
          ],
        },
      ],
      users: [{ id: 'user-1', email: 'q@hajrix.com', nameAr: 'مستخدم', nameEn: 'User' }],
      products: [
        { id: 'product-1', nameAr: 'منتج 1', nameEn: 'Product 1', unit: 'piece' },
        { id: 'product-2', nameAr: 'منتج 2', nameEn: 'Product 2', unit: 'cup' },
      ],
    });

    expect(model.summary).toEqual({
      totalOrders: 1,
      totalQty: 5,
      totalAmount: 35,
      avgPerOrder: 35,
      uniqueProducts: 2,
      uniqueSections: 2,
    });
    expect(model.byUser).toMatchObject([{
      userId: 'user-1',
      username: 'q',
      ordersCount: 1,
      qty: 5,
    }]);
    expect(model.byDay).toEqual([{ date: '2026-06-29', ordersCount: 1, qty: 5 }]);
    expect(model.bySection).toMatchObject([
      { sectionName: 'Cafe', qty: 3, ordersCount: 1, totalAmount: 15, averageAmount: 5 },
      { sectionName: 'Kitchen', qty: 2, ordersCount: 1, totalAmount: 20, averageAmount: 10 },
    ]);
    expect(model.byLog).toMatchObject([
      {
        operationKey: '29-06-2026-A',
        username: 'q',
        qty: 5,
        totalAmount: 35,
        sectionsCount: 2,
        sections: ['Kitchen', 'Cafe'],
      },
    ]);
  });
});

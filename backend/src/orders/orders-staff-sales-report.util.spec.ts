import { buildSalesReportSince, staffSaleMatchesReportWindow } from './orders-staff-sales-report.util';

describe('buildSalesReportSince', () => {
  it('يُعيد بداية UTC لليوم — لا وقت منتصف النهار', () => {
    const now = new Date('2026-06-06T15:30:00.000Z');
    const since = buildSalesReportSince(30, now);
    expect(since.toISOString()).toBe('2026-05-07T00:00:00.000Z');
  });
});

describe('staffSaleMatchesReportWindow', () => {
  const since = new Date('2026-05-07T00:00:00.000Z');

  it('يشمل saleDate في أول يوم النافذة (منتصف الليل UTC)', () => {
    const ok = staffSaleMatchesReportWindow(
      { saleDate: new Date('2026-05-07T00:00:00.000Z'), createdAt: new Date('2026-05-07T10:00:00.000Z') },
      since,
    );
    expect(ok).toBe(true);
  });

  it('يشمل saleDate قبل النافذة إذا createdAt داخل النافذة', () => {
    const ok = staffSaleMatchesReportWindow(
      { saleDate: new Date('2026-04-01T00:00:00.000Z'), createdAt: new Date('2026-06-01T10:00:00.000Z') },
      since,
    );
    expect(ok).toBe(true);
  });

  it('يستبعد إذا createdAt و saleDate كلاهما قبل النافذة', () => {
    const ok = staffSaleMatchesReportWindow(
      { saleDate: new Date('2026-04-01T00:00:00.000Z'), createdAt: new Date('2026-04-02T10:00:00.000Z') },
      since,
    );
    expect(ok).toBe(false);
  });

  it('بدون saleDate يعتمد createdAt', () => {
    const ok = staffSaleMatchesReportWindow(
      { saleDate: null, createdAt: new Date('2026-05-10T08:00:00.000Z') },
      since,
    );
    expect(ok).toBe(true);
  });
});

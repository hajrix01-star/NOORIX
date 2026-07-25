import {
  buildSalesReportPeriodFromDays,
  buildSalesReportPeriodFromYmd,
  buildSalesReportSince,
  staffSaleMatchesReportPeriod,
  staffSaleMatchesReportWindow,
} from './orders-staff-sales-report.util';

describe('buildSalesReportSince', () => {
  it('يُعيد بداية UTC لليوم — لا وقت منتصف النهار', () => {
    const now = new Date('2026-06-06T15:30:00.000Z');
    const since = buildSalesReportSince(30, now);
    expect(since.toISOString()).toBe('2026-05-07T00:00:00.000Z');
  });
});

describe('buildSalesReportPeriodFromDays', () => {
  it('sets an explicit inclusive UTC period', () => {
    const now = new Date('2026-06-06T15:30:00.000Z');
    const period = buildSalesReportPeriodFromDays(30, now);
    expect(period.start.toISOString()).toBe('2026-05-07T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-06-06T23:59:59.999Z');
  });
});

describe('buildSalesReportPeriodFromYmd', () => {
  it('normalizes the unified filter range to UTC day boundaries', () => {
    const period = buildSalesReportPeriodFromYmd('2026-07-01', '2026-07-31');
    expect(period.start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-07-31T23:59:59.999Z');
  });
});

describe('staffSaleMatchesReportPeriod', () => {
  const period = buildSalesReportPeriodFromYmd('2026-07-01', '2026-07-31');

  it('uses saleDate as the official report date when available', () => {
    expect(staffSaleMatchesReportPeriod(
      { saleDate: new Date('2026-07-10T00:00:00.000Z'), createdAt: new Date('2026-08-01T10:00:00.000Z') },
      period,
    )).toBe(true);
  });

  it('falls back to createdAt when saleDate is missing', () => {
    expect(staffSaleMatchesReportPeriod(
      { saleDate: null, createdAt: new Date('2026-07-10T10:00:00.000Z') },
      period,
    )).toBe(true);
  });

  it('excludes rows whose official saleDate is outside the selected period', () => {
    expect(staffSaleMatchesReportPeriod(
      { saleDate: new Date('2026-06-30T00:00:00.000Z'), createdAt: new Date('2026-07-10T10:00:00.000Z') },
      period,
    )).toBe(false);
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

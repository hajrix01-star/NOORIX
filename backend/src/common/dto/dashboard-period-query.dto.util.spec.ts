import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DashboardPeriodQueryDto } from './dashboard-period-query.dto';

class TestDashboardPeriodQueryDto extends DashboardPeriodQueryDto {}

describe('DashboardPeriodQueryDto', () => {
  it('validates the shared dashboard period contract', () => {
    const dto = plainToInstance(TestDashboardPeriodQueryDto, {
      companyId: 'company-1',
      year: '2026',
      yearStart: '2026-01-01',
      yearEnd: '2026-12-31',
      dailyStart: '2026-07-05',
      dailyEnd: '2026-07-05',
      monthStart: '2026-07-01',
      monthEnd: '2026-07-31',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      selectedMonth: '7',
      includeCancelledSales: 'true',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.year).toBe(2026);
    expect(dto.selectedMonth).toBe(7);
    expect(dto.includeCancelledSales).toBe(true);
  });

  it('rejects dates and month values outside the dashboard contract', () => {
    const dto = plainToInstance(TestDashboardPeriodQueryDto, {
      companyId: 'company-1',
      year: '2026',
      yearStart: '2026/01/01',
      yearEnd: '2026-12-31',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      selectedMonth: '13',
    });

    const properties = validateSync(dto).map((error) => error.property);

    expect(properties).toContain('yearStart');
    expect(properties).toContain('selectedMonth');
  });
});

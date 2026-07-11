import { describe, expect, it } from 'vitest';
import {
  buildAccountingPeriodColumns,
  getAccountingPeriodYears,
  toggleAccountingFullYearMonths,
  toggleAccountingMonthPeriod,
  toggleAccountingQuarterPeriod,
} from './accountingReportPeriodModel';

describe('accountingReportPeriodModel', () => {
  it('builds independent month columns across years', () => {
    const selection = {
      mode: 'month' as const,
      anchorYear: 2026,
      selectedMonthPeriods: [
        { year: 2026, month: 7 },
        { year: 2025, month: 12 },
      ],
      selectedQuarterPeriods: [],
      selectedYears: [],
    };

    const columns = buildAccountingPeriodColumns({
      selection,
      monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      quarterLabel: 'Q',
    });

    expect(columns.map((column) => column.label)).toEqual(['Jul 2026', 'Dec 2025']);
    expect(getAccountingPeriodYears(selection)).toEqual([2026, 2025]);
  });

  it('sorts selected periods predictably', () => {
    const months = toggleAccountingMonthPeriod({
      periods: [{ year: 2026, month: 7 }],
      itemYear: 2025,
      month: 12,
      anchorYear: 2026,
    });
    const quarters = toggleAccountingQuarterPeriod({
      periods: [{ year: 2026, quarter: 1 }],
      itemYear: 2025,
      quarter: 1,
      anchorYear: 2026,
    });

    expect(months).toEqual([{ year: 2026, month: 7 }, { year: 2025, month: 12 }]);
    expect(quarters).toEqual([{ year: 2026, quarter: 1 }, { year: 2025, quarter: 1 }]);
  });

  it('allows replacing the current period without forcing it to remain selected', () => {
    const months = toggleAccountingMonthPeriod({
      periods: [{ year: 2026, month: 7 }, { year: 2025, month: 12 }],
      itemYear: 2026,
      month: 7,
      anchorYear: 2026,
    });
    const quarters = toggleAccountingQuarterPeriod({
      periods: [{ year: 2026, quarter: 1 }, { year: 2025, quarter: 1 }],
      itemYear: 2026,
      quarter: 1,
      anchorYear: 2026,
    });

    expect(months).toEqual([{ year: 2025, month: 12 }]);
    expect(quarters).toEqual([{ year: 2025, quarter: 1 }]);
  });

  it('can select a full year as separate monthly columns', () => {
    const fullYear = toggleAccountingFullYearMonths({
      periods: [{ year: 2026, month: 7 }],
      itemYear: 2026,
      anchorYear: 2026,
    });
    const withoutFullYear = toggleAccountingFullYearMonths({
      periods: [...fullYear, { year: 2025, month: 12 }],
      itemYear: 2026,
      anchorYear: 2026,
    });

    expect(fullYear).toHaveLength(12);
    expect(fullYear[0]).toEqual({ year: 2026, month: 1 });
    expect(fullYear[11]).toEqual({ year: 2026, month: 12 });
    expect(withoutFullYear).toEqual([{ year: 2025, month: 12 }]);
  });
});

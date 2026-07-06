import { describe, expect, it } from 'vitest';
import {
  calculateDayCloseCashKpis,
  enumerateDayCloseYmdDates,
  pickDayCloseBilingualName,
  resolveDayCloseCompanyName,
  resolveDayCloseCounterpartyLabel,
} from './dayCloseReportModel';

describe('dayCloseReportModel', () => {
  it('enumerates valid inclusive date ranges and rejects invalid ranges', () => {
    expect(enumerateDayCloseYmdDates('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
    expect(enumerateDayCloseYmdDates('2026-02-02', '2026-01-30')).toEqual([]);
    expect(enumerateDayCloseYmdDates('bad', '2026-01-30')).toEqual([]);
  });

  it('resolves bilingual names and company labels deterministically', () => {
    expect(pickDayCloseBilingualName('en', 'Arabic Name', 'English Name')).toBe('English Name');
    expect(pickDayCloseBilingualName('ar', 'Arabic Name', 'English Name')).toBe('Arabic Name');
    expect(pickDayCloseBilingualName('en', ' Arabic fallback ', '  ')).toBe('Arabic fallback');
    expect(
      resolveDayCloseCompanyName({
        companies: [{ id: 'c1', name: 'Fallback Co', nameAr: 'Arabic Co', nameEn: 'English Co' }],
        activeCompanyId: 'c1',
        companyId: 'fallback',
        lang: 'en',
      }),
    ).toBe('English Co');
  });

  it('calculates cash kpis with month-scoped fallback and lifetime footnote state', () => {
    expect(calculateDayCloseCashKpis({ balanceLifetimeCashVaultsEod: 150 })).toEqual({
      monthScoped: 150,
      lifetime: 150,
      showLifetimeFootnote: false,
    });
    expect(
      calculateDayCloseCashKpis({
        balanceLifetimeCashVaultsEod: 150,
        availableCashMonthScoped: 120,
      }),
    ).toEqual({
      monthScoped: 120,
      lifetime: 150,
      showLifetimeFootnote: true,
    });
  });

  it('resolves counterparty labels by supplier, employee, expense line, then notes', () => {
    expect(resolveDayCloseCounterpartyLabel({ supplierNameEn: 'Supplier' }, 'en')).toBe('Supplier');
    expect(resolveDayCloseCounterpartyLabel({ employeeName: 'Employee' }, 'en')).toBe('Employee');
    expect(resolveDayCloseCounterpartyLabel({ expenseLineNameEn: 'Utilities' }, 'en')).toBe('Utilities');
    expect(resolveDayCloseCounterpartyLabel({ notes: 'Manual note' }, 'en')).toBe('Manual note');
  });
});

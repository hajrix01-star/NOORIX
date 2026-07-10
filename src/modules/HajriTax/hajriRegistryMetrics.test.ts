import { describe, expect, it } from 'vitest';
import { computeNetPayable } from '../../constants/taxDisclosure';
import type { VatPlanningRecord } from '../../types/api/domains/hajriTax';
import {
  buildCompanyFilterSelectOptions,
  isHajriDeclarationSubmitted,
  registryInputVat,
  registryOutputVat,
  registryPayload,
} from './hajriRegistryMetrics';
import { clonePayload, escapeHtml } from './hajriTaxScreenHelpers';

describe('hajriRegistryMetrics', () => {
  it('reads saved planning payload numbers through the central disclosure model', () => {
    const payload = clonePayload({
      standard_sales: { amount: 100, adjustment: 0, vat: 15 },
      standard_purchases: { amount: 40, adjustment: 0, vat: 6 },
      prior_adjustments: 1,
      balance_carried: -0.5,
    });
    const row: VatPlanningRecord = {
      id: 'row-1',
      companyId: 'company-1',
      year: 2026,
      quarter: 2,
      payload,
      filingSubmitted: false,
    };

    const normalized = registryPayload(row);

    expect(registryOutputVat(normalized)).toBe(15);
    expect(registryInputVat(normalized)).toBe(6);
    expect(computeNetPayable(normalized)).toBe(9);
  });

  it('keeps company filter labels deterministic when names are duplicated', () => {
    const options = buildCompanyFilterSelectOptions([
      { id: 'company-aaa111', nameAr: 'شركة', nameEn: 'Company', taxNumber: '3001' },
      { id: 'company-bbb222', nameAr: 'شركة', nameEn: 'Company', taxNumber: '3002' },
    ], 'ar');

    expect(options).toEqual([
      { id: 'company-aaa111', label: 'شركة (3001)' },
      { id: 'company-bbb222', label: 'شركة (3002)' },
    ]);
  });

  it('detects submitted records without relying on loose frontend notes only', () => {
    expect(isHajriDeclarationSubmitted({
      id: 'row-1',
      companyId: 'company-1',
      year: 2026,
      quarter: 1,
      payload: clonePayload({}),
      filingSubmitted: true,
    })).toBe(true);

    expect(isHajriDeclarationSubmitted({
      id: 'row-2',
      companyId: 'company-1',
      year: 2026,
      quarter: 1,
      payload: clonePayload({}),
      sourceSnapshot: { source: 'seed-vat-planning-history' },
    })).toBe(true);
  });

  it('escapes print-bound text fully', () => {
    expect(escapeHtml('<script a="1">&x</script>')).toBe('&lt;script a=&quot;1&quot;&gt;&amp;x&lt;/script&gt;');
  });
});

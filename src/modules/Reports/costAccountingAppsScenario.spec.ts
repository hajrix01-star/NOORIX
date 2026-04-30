import { describe, expect, it } from 'vitest';
import { buildCostAppsScenarioFile, parseCostAppsScenarioJson } from './costAccountingAppsScenario';

describe('costAccountingAppsScenario', () => {
  it('roundtrips snapshot fields', () => {
    const json = buildCostAppsScenarioFile({
      grossAppStr: '100',
      grossCashStr: '200',
      grossBankStr: '0',
      vatInclusive: false,
      vatRatePctStr: '15',
      commissionPctStr: '38',
      commissionBase: 'gross',
      fixedLines: [{ id: 'a', label: 'إيجار', amount: '5000' }],
      importFrom: '2026-01-01',
      importTo: '2026-01-31',
      targetProfitStr: '20000',
      reverseGrossStr: '',
      appSharePctStr: '',
      reverseAppSharePctStr: '30',
      cogsLocalPctStr: '50',
      appPriceMarkupPctStr: '30',
    });
    const parsed = parseCostAppsScenarioJson(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.restore.grossAppStr).toBe('100');
    expect(parsed.restore.fixedLines?.[0]?.label).toBe('إيجار');
    expect(parsed.restore.reverseAppSharePctStr).toBe('30');
  });

  it('rejects bad version', () => {
    const r = parseCostAppsScenarioJson(JSON.stringify({ version: 99 }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('bad_version');
  });
});

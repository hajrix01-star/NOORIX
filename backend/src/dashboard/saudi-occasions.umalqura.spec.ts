import { getSaudiOccasionsForYear, hijriToRiyadhYmd } from './saudi-occasions.umalqura';

describe('saudi-occasions.umalqura', () => {
  it('maps 1447 Arafat to 2026-05-26 (Riyadh)', () => {
    expect(hijriToRiyadhYmd(1447, 12, 9)).toBe('2026-05-26');
  });

  it('builds 2026 occasions including estimated Eid al-Adha window', () => {
    const list = getSaudiOccasionsForYear(2026);
    const adha = list.find((o) => o.id === 'eid_adha-1447');
    expect(adha).toBeDefined();
    expect(adha?.fromDate).toBe('2026-05-26');
    expect(adha?.toDate).toBe('2026-05-29');
    expect(adha?.estimated).toBe(true);
    expect(list.find((o) => o.id === 'national')?.estimated).toBe(false);
  });
});

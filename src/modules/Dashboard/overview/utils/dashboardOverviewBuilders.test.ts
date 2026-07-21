import { describe, expect, it } from 'vitest';
import { buildChannelBreakdownRowsFromBackend } from './dashboardOverviewBuilders';

describe('buildChannelBreakdownRowsFromBackend', () => {
  it('keeps backend values and percentages unchanged', () => {
    const rows = buildChannelBreakdownRowsFromBackend({
      lang: 'en',
      rows: [
        { nameAr: 'بنك', nameEn: 'Bank', amount: 300, sharePct: 75 },
        { nameAr: 'نقد', nameEn: 'Cash', amount: 100, sharePct: 25 },
      ],
    });

    expect(rows).toEqual([
      { name: 'Bank', value: 300, pct: '75.0' },
      { name: 'Cash', value: 100, pct: '25.0' },
    ]);
  });
});

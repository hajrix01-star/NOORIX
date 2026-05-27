import { describe, expect, it } from 'vitest';
import { buildChannelPieRows } from './dashboardOverviewBuilders';

describe('buildChannelPieRows', () => {
  const yearSummaries = [
    {
      channels: [
        { amount: 100, vault: { nameAr: 'بنك', nameEn: 'Bank' } },
        { amount: 50, vault: { nameAr: 'نقد', nameEn: 'Cash' } },
      ],
    },
    {
      channels: [{ amount: 200, vault: { nameAr: 'بنك', nameEn: 'Bank' } }],
    },
  ];

  const mayDaily = [
    {
      channels: [{ amount: 30, vault: { nameAr: 'بنك', nameEn: 'Bank' } }],
    },
    {
      channels: [{ amount: 20, vault: { nameAr: 'نقد', nameEn: 'Cash' } }],
    },
  ];

  it('uses daily summaries when a month is selected (page filter)', () => {
    const rows = buildChannelPieRows({
      yearSummaries,
      dailySummaries: mayDaily,
      selectedMonth: 5,
      lang: 'ar',
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: 'بنك', value: 30 });
    expect(rows[1]).toMatchObject({ name: 'نقد', value: 20 });
  });

  it('uses year summaries when no month filter (all months)', () => {
    const rows = buildChannelPieRows({
      yearSummaries,
      dailySummaries: mayDaily,
      selectedMonth: null,
      lang: 'ar',
    });
    expect(rows[0]).toMatchObject({ name: 'بنك', value: 300 });
    expect(rows[1]).toMatchObject({ name: 'نقد', value: 50 });
  });
});

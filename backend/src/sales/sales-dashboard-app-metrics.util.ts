import { monthKeysInRange, ymdParts } from './sales-dashboard-metrics.dates';
import type { DashboardChannelMetricRow, DashboardDailyMetricRow } from './sales-dashboard-metrics.types';

export function appSalesModel(
  yearStart: string,
  yearEnd: string,
  dailyRows: readonly DashboardDailyMetricRow[],
  channelRows: readonly DashboardChannelMetricRow[],
) {
  const monthKeys = monthKeysInRange(yearStart, yearEnd);
  const totals = new Map<string, number>();
  const apps = new Map<string, number>();
  const channels = new Map<
    string,
    {
      id: string;
      nameAr: string;
      nameEn: string | null;
      periodAmount: number;
      months: Record<string, { amount: number; percent: number }>;
    }
  >();

  for (const key of monthKeys) {
    totals.set(key.periodKey, 0);
    apps.set(key.periodKey, 0);
  }

  for (const row of dailyRows) {
    const parts = ymdParts(row.transactionDate);
    if (!parts) continue;
    const periodKey = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
    if (!totals.has(periodKey)) continue;
    totals.set(periodKey, (totals.get(periodKey) ?? 0) + Number(row.totalAmount || 0));
  }

  for (const row of channelRows) {
    if (!totals.has(row.periodKey) || row.type !== 'app') continue;
    const amount = Number(row.amount || 0);
    if (!Number.isFinite(amount) || amount === 0) continue;
    apps.set(row.periodKey, (apps.get(row.periodKey) ?? 0) + amount);
    const existing = channels.get(row.vaultId) ?? {
      id: row.vaultId,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      periodAmount: 0,
      months: {},
    };
    existing.periodAmount += amount;
    existing.months[row.periodKey] = {
      amount: (existing.months[row.periodKey]?.amount ?? 0) + amount,
      percent: 0,
    };
    channels.set(row.vaultId, existing);
  }

  const monthSeries = monthKeys.map((key) => {
    const total = totals.get(key.periodKey) ?? 0;
    const app = apps.get(key.periodKey) ?? 0;
    return {
      ...key,
      total,
      app,
      appPercent: total > 0 ? (app / total) * 100 : 0,
    };
  });

  const periodTotal = monthSeries.reduce((sum, row) => sum + row.total, 0);
  const periodApp = monthSeries.reduce((sum, row) => sum + row.app, 0);

  const channelRowsOut = Array.from(channels.values())
    .map((row) => {
      const months: Record<string, { amount: number; percent: number }> = {};
      for (const key of monthKeys) {
        const amount = row.months[key.periodKey]?.amount ?? 0;
        const monthTotal = totals.get(key.periodKey) ?? 0;
        months[key.periodKey] = {
          amount,
          percent: monthTotal > 0 ? (amount / monthTotal) * 100 : 0,
        };
      }
      return {
        id: row.id,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        periodAmount: row.periodAmount,
        periodPercent: periodTotal > 0 ? (row.periodAmount / periodTotal) * 100 : 0,
        months,
      };
    })
    .filter((row) => row.periodAmount > 0)
    .sort((a, b) => b.periodAmount - a.periodAmount);

  return {
    monthSeries,
    channels: channelRowsOut,
    periodTotal,
    periodApp,
    periodAppPercent: periodTotal > 0 ? (periodApp / periodTotal) * 100 : 0,
    hasData: periodTotal > 0,
  };
}

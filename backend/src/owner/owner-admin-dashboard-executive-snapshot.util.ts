import Decimal from 'decimal.js';

export type OwnerExecutiveDailySalesSource = {
  amount: Decimal.Value;
  date: Date | string;
};

export type OwnerExecutiveSalesChannelSource = {
  amount: Decimal.Value;
  id: string;
  labelAr: string;
  labelEn: string | null;
};

type Direction = 'up' | 'down' | 'stable';

type OwnerExecutiveSnapshot = {
  coverage: { currentDays: number; previousDays: number };
  dailySales: Array<{ amount: number; date: string }>;
  latestCompleteDay: {
    changeAmount: number;
    changePercent: number;
    date: string;
    direction: Direction;
    previousDaySales: number;
    sales: number;
  };
  monthEndForecast: number;
  salesChannels: Array<OwnerExecutiveSalesChannelSource & { amount: number }>;
};

function ymd(value: Date | string): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) throw new Error('Invalid executive sales date');
    return value.toISOString().slice(0, 10);
  }
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid executive sales date');
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Invalid executive sales date');
  }
  return date;
}

function amount(value: Decimal.Value): number {
  const parsed = new Decimal(value);
  if (!parsed.isFinite() || parsed.isNegative()) throw new Error('Invalid executive sales amount');
  return parsed.toNumber();
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function dayCountInMonth(date: string): number {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0)).getUTCDate();
}

function change(current: number, previous: number): {
  changeAmount: number;
  changePercent: number;
  direction: Direction;
} {
  const changeAmount = new Decimal(current).minus(previous).toNumber();
  const direction: Direction = current > previous ? 'up' : current < previous ? 'down' : 'stable';
  const changePercent = previous === 0
    ? current === 0 ? 0 : 100
    : new Decimal(changeAmount).div(new Decimal(previous).abs()).mul(100).toDecimalPlaces(2).toNumber();
  return { changeAmount, changePercent, direction };
}

/**
 * Builds a source-owned executive view from the official P&L daily totals and
 * DailySalesSummary channel allocations. Empty calendar days are explicit zero
 * source values, never client-side estimates.
 */
export function buildOwnerAdminDashboardExecutiveSnapshot(input: {
  dailySales: readonly OwnerExecutiveDailySalesSource[];
  latestCompleteDate: string;
  salesChannels: readonly OwnerExecutiveSalesChannelSource[];
}): OwnerExecutiveSnapshot {
  const latestCompleteDate = ymd(input.latestCompleteDate);
  const salesByDay = new Map<string, Decimal>();
  for (const row of input.dailySales) {
    const date = ymd(row.date);
    const value = new Decimal(row.amount);
    if (!value.isFinite() || value.isNegative()) throw new Error('Invalid executive sales amount');
    salesByDay.set(date, (salesByDay.get(date) ?? new Decimal(0)).plus(value));
  }

  const firstDailyDate = addDays(latestCompleteDate, -13);
  const dailySales = Array.from({ length: 14 }, (_, index) => {
    const date = addDays(firstDailyDate, index);
    return { amount: amount(salesByDay.get(date) ?? new Decimal(0)), date };
  });
  const sales = dailySales[13]!.amount;
  const previousDaySales = dailySales[12]!.amount;
  const coverageCurrentDays = Number(latestCompleteDate.slice(8, 10));
  const previousMonthLastDate = new Date(`${latestCompleteDate}T00:00:00.000Z`);
  previousMonthLastDate.setUTCMonth(previousMonthLastDate.getUTCMonth() - 1, 1);
  const coveragePreviousDays = Math.min(
    coverageCurrentDays,
    dayCountInMonth(previousMonthLastDate.toISOString().slice(0, 10)),
  );
  const monthStart = `${latestCompleteDate.slice(0, 7)}-01`;
  const currentMonthSales = [...salesByDay.entries()]
    .filter(([date]) => date >= monthStart && date <= latestCompleteDate)
    .reduce((total, [, value]) => total.plus(value), new Decimal(0));
  const monthEndForecast = currentMonthSales
    .div(coverageCurrentDays)
    .mul(dayCountInMonth(latestCompleteDate))
    .toDecimalPlaces(2)
    .toNumber();
  const channelById = new Map<string, OwnerExecutiveSalesChannelSource & { amount: number }>();
  for (const channel of input.salesChannels) {
    const id = channel.id.trim();
    const labelAr = channel.labelAr.trim();
    const labelEn = channel.labelEn?.trim() || null;
    if (!id || !labelAr) throw new Error('Invalid executive sales channel');
    const previous = channelById.get(id);
    channelById.set(id, {
      ...channel,
      id,
      labelAr,
      labelEn,
      amount: amount(channel.amount) + (previous?.amount ?? 0),
    });
  }
  const channelSales = [...channelById.values()]
    .reduce((total, channel) => total.plus(channel.amount), new Decimal(0));
  const otherLedgerSales = currentMonthSales.minus(channelSales);
  if (otherLedgerSales.isNegative()) {
    throw new Error('Executive channel totals exceed official sales');
  }
  if (!otherLedgerSales.isZero()) {
    channelById.set('ledger-other-sales', {
      id: 'ledger-other-sales',
      labelAr: 'مبيعات دفترية أخرى',
      labelEn: 'Other ledger sales',
      amount: otherLedgerSales.toNumber(),
    });
  }
  const dailyChange = change(sales, previousDaySales);

  return {
    coverage: { currentDays: coverageCurrentDays, previousDays: coveragePreviousDays },
    dailySales,
    latestCompleteDay: {
      date: latestCompleteDate,
      sales,
      previousDaySales,
      ...dailyChange,
    },
    monthEndForecast,
    salesChannels: [...channelById.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

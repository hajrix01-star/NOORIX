import { toYmd } from '../common/utils/to-ymd.util';

export type SalesShiftValue = 'all' | 'morning' | 'evening';

export type SalesListVaultRef = {
  id?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  name?: string | null;
  sortOrder?: number | null;
  type?: string | null;
  paymentMethod?: string | null;
};

export type SalesListChannelEntry = {
  vaultId?: string;
  amount?: number | string | { toString(): string } | null;
  vault?: SalesListVaultRef | null;
};

export type SalesSummaryListSource = {
  id: string;
  summaryNumber?: string | number | null;
  transactionDate?: Date | string | null;
  customerCount?: number | null;
  totalAmount?: number | string | { toString(): string } | null;
  cashOnHand?: number | string | { toString(): string } | null;
  notes?: string | null;
  status?: string | null;
  shift?: string | null;
  channels?: SalesListChannelEntry[] | null;
};

export type SalesSummaryListItem = {
  id: string;
  summaryNumber?: string | number | null;
  transactionDate: string;
  customerCount: number;
  totalAmount: number;
  cashOnHand: number;
  avgPerCustomer: number;
  notes?: string | null;
  status: string;
  shift: SalesShiftValue;
  channels: SalesListChannelEntry[];
  channelsText: string;
};

export type SalesSummaryDayRow = SalesSummaryListItem & {
  summaryNumbersText: string;
  shiftsText: string;
  summaries: SalesSummaryListItem[];
};

export type SalesSummaryPageSummary = {
  rowCount: number;
  customerCount: number;
  totalAmount: number;
  avgPerCustomer: number;
};

export type SalesSummaryListModel = {
  items: SalesSummaryListItem[];
  dayRows: SalesSummaryDayRow[];
  pageSummary: SalesSummaryPageSummary;
};

const SHIFT_ORDER: Record<SalesShiftValue, number> = { morning: 1, evening: 2, all: 3 };

function amount(value: SalesSummaryListSource['totalAmount']): number {
  const n = Number(value?.toString?.() ?? value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function resolveShift(value: string | null | undefined): SalesShiftValue {
  return value === 'morning' || value === 'evening' || value === 'all' ? value : 'all';
}

function avg(totalAmount: number, customerCount: number): number {
  return customerCount > 0 ? totalAmount / customerCount : 0;
}

function sortChannels(channels: SalesListChannelEntry[]): SalesListChannelEntry[] {
  return [...channels].sort((a, b) => {
    const av = a.vault;
    const bv = b.vault;
    return (
      (av?.sortOrder ?? 0) - (bv?.sortOrder ?? 0)
      || String(av?.nameAr ?? av?.name ?? '').localeCompare(String(bv?.nameAr ?? bv?.name ?? ''), 'ar')
    );
  });
}

function mergeChannels(summaries: readonly SalesSummaryListItem[]): SalesListChannelEntry[] {
  const buckets = new Map<string, SalesListChannelEntry>();
  for (const summary of summaries) {
    for (const channel of summary.channels) {
      const vaultId = channel.vaultId ?? channel.vault?.id;
      const key = vaultId ?? `name:${channel.vault?.nameAr ?? channel.vault?.nameEn ?? channel.vault?.name ?? ''}`;
      const prev = buckets.get(key);
      const nextAmount = amount(prev?.amount ?? 0) + amount(channel.amount ?? 0);
      buckets.set(key, {
        ...channel,
        ...(vaultId ? { vaultId } : {}),
        amount: nextAmount,
        vault: channel.vault ?? prev?.vault ?? null,
      });
    }
  }
  return sortChannels([...buckets.values()]).filter((channel) => amount(channel.amount) > 0);
}

export function buildSalesSummaryListItem(source: SalesSummaryListSource): SalesSummaryListItem {
  const totalAmount = amount(source.totalAmount);
  const customerCount = Number.isFinite(Number(source.customerCount)) ? Number(source.customerCount) : 0;
  return {
    id: source.id,
    summaryNumber: source.summaryNumber ?? null,
    transactionDate: toYmd(source.transactionDate ?? ''),
    customerCount,
    totalAmount,
    cashOnHand: amount(source.cashOnHand),
    avgPerCustomer: avg(totalAmount, customerCount),
    notes: source.notes ?? null,
    status: source.status ?? 'active',
    shift: resolveShift(source.shift),
    channels: sortChannels(source.channels ?? []),
    channelsText: '',
  };
}

export function buildSalesSummaryListModel(sources: readonly SalesSummaryListSource[]): SalesSummaryListModel {
  const items = sources.map(buildSalesSummaryListItem);
  const groups = new Map<string, SalesSummaryListItem[]>();
  for (const item of items) {
    const list = groups.get(item.transactionDate) ?? [];
    list.push(item);
    groups.set(item.transactionDate, list);
  }

  const dayRows: SalesSummaryDayRow[] = [...groups.entries()].map(([dateKey, summaries]) => {
    const ordered = [...summaries].sort((a, b) => SHIFT_ORDER[a.shift] - SHIFT_ORDER[b.shift]);
    const primary = ordered[0];
    const totalAmount = ordered.reduce((sum, item) => sum + item.totalAmount, 0);
    const customerCount = ordered.reduce((sum, item) => sum + item.customerCount, 0);
    const cashOnHand = ordered.reduce((sum, item) => sum + item.cashOnHand, 0);
    const summaryNumbersText = ordered.map((item) => item.summaryNumber).filter(Boolean).join(' / ');
    const shiftsText = ordered.map((item) => item.shift).join(' / ');
    const hasCancelled = ordered.some((item) => item.status === 'cancelled');
    const allCancelled = ordered.every((item) => item.status === 'cancelled');
    return {
      ...primary,
      id: `day-${dateKey}`,
      summaryNumber: summaryNumbersText || primary.summaryNumber,
      summaryNumbersText,
      transactionDate: dateKey,
      shift: ordered.length === 1 ? primary.shift : 'all',
      shiftsText,
      channels: mergeChannels(ordered),
      customerCount,
      cashOnHand,
      totalAmount,
      avgPerCustomer: avg(totalAmount, customerCount),
      status: allCancelled ? 'cancelled' : hasCancelled ? 'active' : primary.status,
      summaries: ordered,
    };
  });

  const activeRows = dayRows.filter((row) => row.status !== 'cancelled');
  const totalAmount = activeRows.reduce((sum, row) => sum + row.totalAmount, 0);
  const customerCount = activeRows.reduce((sum, row) => sum + row.customerCount, 0);
  return {
    items,
    dayRows,
    pageSummary: {
      rowCount: activeRows.length,
      customerCount,
      totalAmount,
      avgPerCustomer: avg(totalAmount, customerCount),
    },
  };
}

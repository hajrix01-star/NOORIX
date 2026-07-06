import { formatSaudiDateISO } from '../../utils/saudiDate';

const EMPTY_REPORT_VALUE = '\u2014';

export const MAX_DAY_CLOSE_RANGE_DAYS = 31;

export type DayCloseLanguage = 'ar' | 'en' | string;

export type DayCloseCompanySource = {
  id?: string;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

export type DayCloseNamedSource = {
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

export type DayCloseCashSource = {
  balanceLifetimeCashVaultsEod?: unknown;
  balanceEndOfDayCashVaults?: unknown;
  availableCashMonthScoped?: unknown;
};

export type DayCloseOperationSource = {
  supplierName?: string | null;
  supplierNameAr?: string | null;
  supplierNameEn?: string | null;
  employeeName?: string | null;
  expenseLineName?: string | null;
  expenseLineNameAr?: string | null;
  expenseLineNameEn?: string | null;
  notes?: string | null;
};

export type DayCloseCashKpis = {
  monthScoped: number;
  lifetime: number;
  showLifetimeFootnote: boolean;
};

export type DayCloseKindLabels = Record<string, string>;

export type DayCloseTotalRow = {
  count?: number | string | null;
  total?: number | string | null;
};

export type DayCloseKindRow = DayCloseTotalRow & {
  kind?: string | null;
};

export type DayClosePaymentRow = DayCloseTotalRow & {
  vaultId?: string | null;
  label?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

export type DayCloseSalesChannel = {
  amount?: number | string | null;
  vaultName?: string | null;
  vaultNameAr?: string | null;
  vaultNameEn?: string | null;
  vaultType?: string | null;
};

export type DayCloseSalesSummary = {
  id?: string;
  summaryNumber?: string | number | null;
  customerCount?: number | string | null;
  cashOnHand?: number | string | null;
  totalAmount?: number | string | null;
  channels?: DayCloseSalesChannel[];
};

export type DayCloseVaultMovementRow = {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
  type?: string | null;
  totalIn?: number | string | null;
  totalOut?: number | string | null;
  netDay?: number | string | null;
};

export type DayCloseOperationRow = DayCloseOperationSource & {
  id: string;
  invoiceNumber?: string | number | null;
  kind?: string | null;
  totalAmount?: number | string | null;
  status?: string | null;
  vaultName?: string | null;
  vaultNameAr?: string | null;
  vaultNameEn?: string | null;
};

export type DayCloseReportData = {
  meta?: {
    cashMonthScopeStart?: unknown;
    invoicesTruncated?: boolean;
    operationsReturned?: number | string | null;
    invoiceCountAll?: number | string | null;
  };
  sums?: {
    inflow?: DayCloseTotalRow;
    outflow?: DayCloseTotalRow;
  };
  cash?: DayCloseCashSource & {
    netDay?: number | string | null;
    dayTotalIn?: number | string | null;
    dayTotalOut?: number | string | null;
  };
  transfers?: {
    volume?: number | string | null;
    count?: number | string | null;
  };
  byKind?: DayCloseKindRow[];
  outflowByPaymentMethod?: DayClosePaymentRow[];
  salesSummaries?: DayCloseSalesSummary[];
  vaults?: {
    movementOnDayByVault?: DayCloseVaultMovementRow[];
  };
  operations?: DayCloseOperationRow[];
};

export type DayClosePrintRow = {
  date: string;
  data: DayCloseReportData;
};

export function padDayCloseNumber(value: number) {
  return String(value).padStart(2, '0');
}

export function enumerateDayCloseYmdDates(startStr: string, endStr: string) {
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const dates: string[] = [];
  for (let cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
    dates.push(
      `${cur.getUTCFullYear()}-${padDayCloseNumber(cur.getUTCMonth() + 1)}-${padDayCloseNumber(
        cur.getUTCDate(),
      )}`,
    );
  }
  return dates;
}

export function pickDayCloseBilingualName(
  lang: DayCloseLanguage,
  nameAr?: string | null,
  nameEn?: string | null,
) {
  const ar = nameAr != null && String(nameAr).trim() !== '' ? String(nameAr).trim() : '';
  const en = nameEn != null && String(nameEn).trim() !== '' ? String(nameEn).trim() : '';
  if (lang === 'en') return en || ar || EMPTY_REPORT_VALUE;
  return ar || en || EMPTY_REPORT_VALUE;
}

export function resolveDayCloseCompanyName(input: {
  companies?: DayCloseCompanySource[];
  activeCompanyId?: string;
  companyId: string;
  lang: DayCloseLanguage;
}) {
  const company = input.companies?.find((item) => item.id === (input.activeCompanyId || input.companyId));
  if (!company) return '';
  return input.lang === 'en'
    ? company.nameEn || company.nameAr || company.name || ''
    : company.nameAr || company.nameEn || company.name || '';
}

export function formatDayCloseMonthStartLabel(monthStartYmd?: unknown) {
  return typeof monthStartYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(monthStartYmd)
    ? formatSaudiDateISO(`${monthStartYmd}T12:00:00.000Z`)
    : EMPTY_REPORT_VALUE;
}

export function calculateDayCloseCashKpis(cash?: DayCloseCashSource): DayCloseCashKpis {
  const lifetime = Number(cash?.balanceLifetimeCashVaultsEod ?? cash?.balanceEndOfDayCashVaults ?? 0);
  const raw = cash?.availableCashMonthScoped;
  const monthScoped = raw != null && raw !== '' ? Number(raw) : lifetime;
  return {
    monthScoped,
    lifetime,
    showLifetimeFootnote:
      Number.isFinite(monthScoped) && Number.isFinite(lifetime) && Math.abs(monthScoped - lifetime) > 1e-6,
  };
}

export function resolveDayCloseCounterpartyLabel(op: DayCloseOperationSource, lang: DayCloseLanguage) {
  const supplier = pickDayCloseBilingualName(lang, op.supplierNameAr ?? op.supplierName, op.supplierNameEn);
  if (supplier !== EMPTY_REPORT_VALUE) return supplier;
  if (op.employeeName) return op.employeeName;
  const expenseLine = pickDayCloseBilingualName(
    lang,
    op.expenseLineNameAr ?? op.expenseLineName,
    op.expenseLineNameEn,
  );
  if (expenseLine !== EMPTY_REPORT_VALUE) return expenseLine;
  return op.notes || EMPTY_REPORT_VALUE;
}

export function isValidDayCloseDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isDayCloseReportData(value: unknown): value is DayCloseReportData {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function normalizeDayCloseReportData(value: unknown): DayCloseReportData {
  return isDayCloseReportData(value) ? value : {};
}

export function getEmptyDayCloseValue() {
  return EMPTY_REPORT_VALUE;
}

export function formatDayCloseReportDateLabel(dateYmd: string) {
  return formatSaudiDateISO(`${dateYmd}T12:00:00.000Z`);
}

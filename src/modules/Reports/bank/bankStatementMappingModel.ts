import { formatSaudiDate, toYmd } from '../../../utils/saudiDate';
import {
  extractDateFromCell,
  type BankSheetCell,
  type BankSheetData,
  type BankSheetRow,
} from './bankMappingAutoDetect';
import type { BankStatementLite } from './bankAnalysisTab.types';

export const COLUMN_FIELD_DEFS = [
  { key: 'dateCol', labelKey: 'bankMapColDate', required: true, badgeClass: 'bank-map-badge--date', cellClass: 'bank-map-cell--date' },
  { key: 'descCol', labelKey: 'bankMapColDescription', required: true, badgeClass: 'bank-map-badge--desc', cellClass: 'bank-map-cell--desc' },
  { key: 'debitCol', labelKey: 'bankMapColDebit', required: true, badgeClass: 'bank-map-badge--debit', cellClass: 'bank-map-cell--debit' },
  { key: 'creditCol', labelKey: 'bankMapColCredit', required: true, badgeClass: 'bank-map-badge--credit', cellClass: 'bank-map-cell--credit' },
  { key: 'balanceCol', labelKey: 'bankMapColBalance', required: false, badgeClass: 'bank-map-badge--balance', cellClass: 'bank-map-cell--balance' },
  { key: 'refCol', labelKey: 'bankMapColReference', required: false, badgeClass: 'bank-map-badge--ref', cellClass: 'bank-map-cell--ref' },
  { key: 'notesCol', labelKey: 'bankMapColNotes', required: false, badgeClass: 'bank-map-badge--notes', cellClass: 'bank-map-cell--notes' },
] as const;

export type ColumnMapKey = typeof COLUMN_FIELD_DEFS[number]['key'];
export type MappingColumnMap = Record<ColumnMapKey, number>;
export type HeaderCell = { index: number; label: string };
export type MappingStatement = BankStatementLite & {
  rawData?: BankSheetData | null;
  _fullRaw?: BankSheetData;
};
export type HeaderMetadata = {
  customerName?: string | null;
  bankName?: string | null;
  periodFrom?: BankSheetCell;
  periodTo?: BankSheetCell;
};
export type BankStatementMappingModalProps = {
  statement: MappingStatement;
  companyId: string;
  onClose: () => void;
  onConfirm: () => void;
  showToast: (message: string, type?: string) => void;
};

type ConfirmMappingData = {
  transactionCount?: number | string | null;
};

type DetectedBankColumns = {
  date?: number;
  description?: number;
  debit?: number;
  credit?: number;
  balance?: number;
  reference?: number;
  notes?: number;
};

export function normalizeDateForInput(value: BankSheetCell): string {
  if (!value) return '';
  const ymd = toYmd(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return toYmd(extractDateFromCell(value)) || '';
}

export function emptyColumnMap(): MappingColumnMap {
  return {
    dateCol: -1,
    descCol: -1,
    debitCol: -1,
    creditCol: -1,
    balanceCol: -1,
    refCol: -1,
    notesCol: -1,
  };
}

export function buildDetectedColumnMap(detectedColumns: DetectedBankColumns): MappingColumnMap {
  return {
    dateCol: detectedColumns.date ?? -1,
    descCol: detectedColumns.description ?? -1,
    debitCol: detectedColumns.debit ?? -1,
    creditCol: detectedColumns.credit ?? -1,
    balanceCol: detectedColumns.balance ?? -1,
    refCol: detectedColumns.reference ?? -1,
    notesCol: detectedColumns.notes ?? -1,
  };
}

export function hasRequiredColumnMapping(columnMapping: MappingColumnMap): boolean {
  return columnMapping.dateCol >= 0 && columnMapping.descCol >= 0 && columnMapping.debitCol >= 0 && columnMapping.creditCol >= 0;
}

export function nonEmptyRow(row: BankSheetRow): boolean {
  return row.some((cell) => cell !== '' && cell != null);
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function getConfirmTransactionCount(data: unknown): string {
  if (!data || typeof data !== 'object') return '0';
  const value = (data as ConfirmMappingData).transactionCount;
  return String(value ?? 0);
}

export function formatMappingCell(cell: BankSheetCell): string {
  if (cell instanceof Date) return formatSaudiDate(cell);
  return String(cell ?? '').slice(0, 48);
}

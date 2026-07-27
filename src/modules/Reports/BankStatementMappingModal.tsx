import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useTranslation } from '../../i18n/useTranslation';
import { bankStatementConfirmMapping, bankStatementGet, bankStatementSuggestHeaderMetadata } from '../../services/api';
import { Button, AdaptiveSheet, DateRangeField, DialogActions, Input } from '../../ui';
import {
  autoDetectRows,
  autoDetectColumns,
  countDataRowsFrom,
  extractDateFromCell,
  sanitizeBankName,
  sanitizeCustomerName,
  type BankSheetCell,
  type BankSheetData,
  type BankSheetRow,
} from './bank/bankMappingAutoDetect';
import { formatSaudiDate, toYmd } from '../../utils/saudiDate';
import { bankKeys } from '../../services/queryKeys';
import type { BankStatementLite } from './bank/bankAnalysisTab.types';

const COLUMN_FIELD_DEFS = [
  { key: 'dateCol', labelKey: 'bankMapColDate', required: true, badgeClass: 'bank-map-badge--date', cellClass: 'bank-map-cell--date' },
  { key: 'descCol', labelKey: 'bankMapColDescription', required: true, badgeClass: 'bank-map-badge--desc', cellClass: 'bank-map-cell--desc' },
  { key: 'debitCol', labelKey: 'bankMapColDebit', required: true, badgeClass: 'bank-map-badge--debit', cellClass: 'bank-map-cell--debit' },
  { key: 'creditCol', labelKey: 'bankMapColCredit', required: true, badgeClass: 'bank-map-badge--credit', cellClass: 'bank-map-cell--credit' },
  { key: 'balanceCol', labelKey: 'bankMapColBalance', required: false, badgeClass: 'bank-map-badge--balance', cellClass: 'bank-map-cell--balance' },
  { key: 'refCol', labelKey: 'bankMapColReference', required: false, badgeClass: 'bank-map-badge--ref', cellClass: 'bank-map-cell--ref' },
  { key: 'notesCol', labelKey: 'bankMapColNotes', required: false, badgeClass: 'bank-map-badge--notes', cellClass: 'bank-map-cell--notes' },
] as const;

type ColumnMapKey = typeof COLUMN_FIELD_DEFS[number]['key'];
type MappingColumnMap = Record<ColumnMapKey, number>;
type HeaderCell = { index: number; label: string };
type MappingStatement = BankStatementLite & {
  rawData?: BankSheetData | null;
  _fullRaw?: BankSheetData;
};
type HeaderMetadata = {
  customerName?: string | null;
  bankName?: string | null;
  periodFrom?: BankSheetCell;
  periodTo?: BankSheetCell;
};
type ConfirmMappingData = {
  transactionCount?: number | string | null;
};
type BankStatementMappingModalProps = {
  statement: MappingStatement;
  companyId: string;
  onClose: () => void;
  onConfirm: () => void;
  showToast: (message: string, type?: string) => void;
};

function normalizeDateForInput(value: BankSheetCell): string {
  if (!value) return '';
  const ymd = toYmd(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return toYmd(extractDateFromCell(value)) || '';
}

function emptyColumnMap(): MappingColumnMap {
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

function nonEmptyRow(row: BankSheetRow): boolean {
  return row.some((cell) => cell !== '' && cell != null);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getConfirmTransactionCount(data: unknown): string {
  if (!data || typeof data !== 'object') return '0';
  const value = (data as ConfirmMappingData).transactionCount;
  return String(value ?? 0);
}

export default function BankStatementMappingModal({ statement, companyId, onClose, onConfirm, showToast }: BankStatementMappingModalProps) {
  const { t } = useTranslation();
  const hasFullRaw = Array.isArray(statement?._fullRaw) && statement._fullRaw.length > 0;
  const headerAiFetchedRef = useRef<string | null>(null);

  useEffect(() => {
    headerAiFetchedRef.current = null;
  }, [statement?.id]);

  const { data: fetched } = useApiQuery<MappingStatement>({
    queryKey: bankKeys.statementMapping(companyId, statement?.id),
    queryFn: () => bankStatementGet(companyId, statement.id || ''),
    enabled: !!statement?.id && !!companyId && !hasFullRaw,
    fallbackMessage: t('apiRequestFailed'),
  });

  const resolvedStatement = hasFullRaw ? statement : (fetched ?? statement);
  const raw = useMemo<BankSheetData>(() => {
    if (hasFullRaw && Array.isArray(statement._fullRaw)) return statement._fullRaw;
    return Array.isArray(resolvedStatement?.rawData) ? resolvedStatement.rawData : [];
  }, [statement, resolvedStatement, hasFullRaw]);

  const [companyName, setCompanyName] = useState('');
  const [bankName, setBankName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [headerRow, setHeaderRow] = useState(0);
  const [dataStartRow, setDataStartRow] = useState(1);
  const [columnMapping, setColumnMapping] = useState<MappingColumnMap>(emptyColumnMap);
  const [isAutoDetected, setIsAutoDetected] = useState(false);
  const [aiHeaderLoading, setAiHeaderLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dataEndRow = useMemo(() => Math.max(0, raw.length - 1), [raw.length]);

  useEffect(() => {
    if (!raw.length) return;
    const detectedRows = autoDetectRows(raw);
    setHeaderRow(detectedRows.headerRow);
    setDataStartRow(detectedRows.dataStartRow);
    setCompanyName((prev) => (prev.trim() ? prev : sanitizeCustomerName(detectedRows.customerName) || ''));
    setBankName((prev) => (prev.trim() ? prev : sanitizeBankName(detectedRows.bankName) || ''));
    setStartDate((prev) => prev || normalizeDateForInput(detectedRows.periodFrom) || '');
    setEndDate((prev) => prev || normalizeDateForInput(detectedRows.periodTo) || '');
    if (!raw[detectedRows.headerRow]) return;
    const detectedColumns = autoDetectColumns(raw, detectedRows.headerRow, detectedRows.dataStartRow);
    setColumnMapping({
      dateCol: detectedColumns.date ?? -1,
      descCol: detectedColumns.description ?? -1,
      debitCol: detectedColumns.debit ?? -1,
      creditCol: detectedColumns.credit ?? -1,
      balanceCol: detectedColumns.balance ?? -1,
      refCol: detectedColumns.reference ?? -1,
      notesCol: detectedColumns.notes ?? -1,
    });
    setIsAutoDetected(Object.keys(detectedColumns).length >= 3);
  }, [raw, statement?.id]);

  useEffect(() => {
    if (!raw.length || !companyId || !statement?.id) return;
    if (headerAiFetchedRef.current === statement.id) return;
    const hasEnough = companyName.trim() && bankName.trim() && startDate;
    if (hasEnough) {
      headerAiFetchedRef.current = statement.id;
      return;
    }

    headerAiFetchedRef.current = statement.id;
    let cancelled = false;
    setAiHeaderLoading(true);
    bankStatementSuggestHeaderMetadata(companyId, raw)
      .then((res) => {
        if (cancelled || !res?.success) return;
        const data = (res.data ?? res) as HeaderMetadata;
        if (data.customerName) {
          const cleanCustomer = sanitizeCustomerName(data.customerName);
          if (cleanCustomer) setCompanyName((prev) => (prev && prev.trim() ? prev : cleanCustomer));
        }
        if (data.bankName) {
          const cleanBank = sanitizeBankName(data.bankName);
          if (cleanBank) setBankName((prev) => (prev && prev.trim() ? prev : cleanBank));
        }
        if (data.periodFrom) setStartDate((prev) => prev || normalizeDateForInput(data.periodFrom));
        if (data.periodTo) setEndDate((prev) => prev || normalizeDateForInput(data.periodTo));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAiHeaderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statement?.id, companyId, raw, companyName, bankName, startDate]);

  const colCount = raw.length ? Math.max(...raw.map((row) => row.length)) : 0;
  const headers = useMemo<HeaderCell[]>(() => {
    const row = raw[headerRow] || [];
    return Array.from({ length: colCount }, (_unused, index) => ({
      index,
      label: String(row[index] ?? '').trim() || `${t('bankStatementColIgnore')} ${index + 1}`,
    }));
  }, [raw, headerRow, colCount, t]);

  const previewRows = useMemo(
    () => raw.slice(dataStartRow, dataStartRow + 8).filter(nonEmptyRow),
    [raw, dataStartRow],
  );
  const previewTableMinWidth = useMemo(() => Math.max(520, (headers.length + 1) * 120), [headers.length]);
  const totalDataRows = useMemo(() => countDataRowsFrom(raw, dataStartRow), [raw, dataStartRow]);

  const getColumnBadge = useCallback(
    (colIndex: number) => COLUMN_FIELD_DEFS.find((def) => columnMapping[def.key] === colIndex) ?? null,
    [columnMapping],
  );

  const setCol = (key: ColumnMapKey, value: string) => {
    setColumnMapping((prev) => ({ ...prev, [key]: value === '' ? -1 : parseInt(value, 10) }));
  };

  const canConfirm = useMemo(
    () => columnMapping.dateCol >= 0 && columnMapping.descCol >= 0 && columnMapping.debitCol >= 0 && columnMapping.creditCol >= 0,
    [columnMapping],
  );

  const handleConfirm = async () => {
    if (!canConfirm) {
      showToast(t('bankMapRequiredWarningStrict'), 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await bankStatementConfirmMapping(statement.id || '', {
        companyId,
        companyName,
        bankName,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        headerRow,
        dataStartRow,
        dataEndRow,
        columnMapping: {
          ...columnMapping,
          amountCol: -1,
          mergeNotesWithDescription: columnMapping.notesCol >= 0 ? true : undefined,
        },
        raw,
      });
      if (res?.success !== false && res?.data) {
        showToast(t('bankStatementParsedCount', getConfirmTransactionCount(res.data)));
        onConfirm();
      } else {
        showToast(String(res?.error || 'فشل التأكيد'), 'error');
      }
    } catch (err: unknown) {
      showToast(errorMessage(err, 'فشل التأكيد'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCell = (cell: BankSheetCell): string => {
    if (cell instanceof Date) return formatSaudiDate(cell);
    return String(cell ?? '').slice(0, 48);
  };

  return (
    <AdaptiveSheet
      open={!!statement}
      onClose={onClose}
      title={t('bankMapTitle')}
      size="full"
      side="start"
      className="bank-mapping-drawer"
      footer={
        <div className="flex flex flex-wrap flex items-center justify-between gap-3 w-full">
          <div>
            {!canConfirm ? (
              <div className="bank-map-warning flex gap-1.5 text-[13px] items-center">
                <span>⚠</span>
                <span>{t('bankMapRequiredWarningStrict')}</span>
              </div>
            ) : null}
          </div>
          <DialogActions
            actions={[
              { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: onClose },
              {
                key: 'confirm',
                label: isSubmitting ? t('bankStatementAIApplying') : t('bankMapConfirmAnalyze'),
                role: 'primary',
                disabled: !canConfirm || isSubmitting,
                onClick: handleConfirm,
              },
            ]}
          />
        </div>
      }
    >
      <p className="text-[13px] text-noorix-muted m-0 mb-3.5">{t('bankMapSubtitle')}</p>

      <div className="bank-map-info-panel rounded-lg p-3.5 mb-3.5">
        <div className="flex items-center flex flex-wrap gap-2 mb-2.5">
          <span className="bank-map-info-title font-bold text-[13px]">{t('bankMapStatementInfo')}</span>
          {aiHeaderLoading ? (
            <span className="bank-map-chip bank-map-chip--blue text-[11px] py-px px-2 rounded-md">{t('bankMapAiReading')}</span>
          ) : null}
          <span className="bank-map-chip bank-map-chip--surface ms-auto text-[11px] py-px px-2 rounded-md border border-noorix-border">
            {totalDataRows} {t('bankMapOperationsCount')}
          </span>
          <span className="bank-map-chip bank-map-chip--surface text-[11px] py-px px-2 rounded-md border border-noorix-border">
            {t('bankMapHeaderRowBadge', String(headerRow + 1))}
          </span>
          {isAutoDetected ? (
            <span className="bank-map-chip bank-map-chip--green text-[11px] py-px px-2 rounded-md">✓ {t('bankMapColumnsDetected')}</span>
          ) : null}
        </div>
        <div className="bank-map-metadata-grid grid gap-2.5">
          <Input
            type="text"
            label={t('bankMapCustomerLabel')}
            value={companyName}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setCompanyName(event.target.value)}
            placeholder={t('bankMapCustomerPlaceholder')}
          />
          <Input
            type="text"
            label={t('bankMapBankLabel')}
            value={bankName}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBankName(event.target.value)}
            placeholder={t('bankMapBankPlaceholder')}
          />
          <DateRangeField
            startLabel={t('bankMapPeriodFrom')}
            endLabel={t('bankMapPeriodTo')}
            startValue={startDate}
            endValue={endDate}
            minEnd={startDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        </div>
      </div>

      {!Object.values(columnMapping).some((value) => value >= 0) && raw.length > 0 ? (
        <div className="bank-map-auto-detect-warning rounded-lg text-[13px] mb-3 p-[10px]">
          {t('bankStatementNoAutoDetect')}
        </div>
      ) : null}

      <div className="border border-noorix-border rounded-lg p-3.5 mb-[14px]">
        <div className="text-[14px] font-bold mb-2.5">{t('bankStatementMapColumns')}</div>
        <div className="bank-map-columns-grid grid gap-3">
          {COLUMN_FIELD_DEFS.map((col) => (
            <div key={col.key}>
              <label className="flex items-center gap-6 text-[12px] font-semibold mb-1">
                <span>
                  {t(col.labelKey)}
                  {col.required ? <span className="text-noorix-red"> *</span> : null}
                </span>
                {columnMapping[col.key] >= 0 ? <span className="text-noorix-green">✓</span> : null}
              </label>
              <Input
                type="select"
                value={columnMapping[col.key] >= 0 ? columnMapping[col.key] : ''}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setCol(col.key, event.target.value)}
              >
                <option value="">{t('bankMapSelectColumn')}</option>
                {Array.from({ length: colCount }, (_unused, index) => (
                  <option key={index} value={index}>
                    {headers[index]?.label?.slice(0, 55) || index + 1}
                  </option>
                ))}
              </Input>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-noorix-border rounded-lg overflow-hidden mb-4">
        <div className="bg-noorix-bg-muted border-b border-noorix-border font-semibold text-[13px] px-3 py-2">
          {t('bankMapPreviewTitle')}{' '}
          <span className="font-normal text-[12px] text-noorix-muted">{t('bankMapPreviewHint')}</span>
        </div>
        <div className="overflow-auto max-h-[300px]">
          <table className="w-full border-collapse text-[12px]" style={{ minWidth: previewTableMinWidth }}>
            <thead>
              <tr className="bg-noorix-bg-muted">
                <th className="py-2 px-1.5 w-9">#</th>
                {headers.map((header) => {
                  const badge = getColumnBadge(header.index);
                  return (
                    <th key={header.index} className="py-2 px-1.5 text-start align-top min-w-[100px]">
                      <div className="font-semibold">{header.label}</div>
                      {badge ? (
                        <div className={`mt-1 text-[11px] font-bold py-px px-1.5 rounded inline-block ${badge.badgeClass}`}>
                          {t(badge.labelKey)}
                        </div>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-t border-noorix-border">
                  <td className="p-1.5 text-noorix-muted">{rowIdx + 1}</td>
                  {headers.map((header) => {
                    const badge = getColumnBadge(header.index);
                    return (
                      <td key={header.index} className={`p-1.5 max-w-[140px] ${badge ? `font-semibold ${badge.cellClass}` : 'font-normal'}`}>
                        {formatCell(row[header.index])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdaptiveSheet>
  );
}

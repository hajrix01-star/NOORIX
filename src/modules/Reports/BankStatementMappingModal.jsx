/**
 * BankStatementMappingModal — مطابقة BankColumnMapper.jsx (Base44) دون امتدادات واجهة
 * - لا حقول تعديل صف العناوين/البيانات (يُشتق من autoDetectRows فقط مثل القديم)
 * - لا عمود مبلغ موحد (لم يكن في COLUMN_TYPES القديم)
 * - إلزام: تاريخ + وصف + مدين + دائن (مثل requiredMapped في القديم)
 * - دمج الملاحظات مع الوصف تلقائياً عند وجود عمود ملاحظات (كما في applyTemplate بالقديم)
 */
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { bankStatementConfirmMapping, bankStatementGet, bankStatementSuggestHeaderMetadata } from '../../services/api';
import { Button, AdaptiveSheet, Input } from '../../ui';
import {
  autoDetectRows,
  autoDetectColumns,
  countDataRowsFrom,
  extractDateFromCell,
} from './bank/bankMappingAutoDetect';

/** مطابق COLUMN_TYPES في Base44 (بدون amount) */
const COLUMN_FIELD_DEFS = [
  { key: 'dateCol', labelKey: 'bankMapColDate', required: true, badgeBg: 'var(--noorix-blue-18)', badgeColor: 'var(--noorix-accent-blue)' },
  { key: 'descCol', labelKey: 'bankMapColDescription', required: true, badgeBg: 'var(--noorix-violet-15)', badgeColor: 'var(--noorix-accent-violet)' },
  { key: 'debitCol', labelKey: 'bankMapColDebit', required: true, badgeBg: 'var(--noorix-red-15)', badgeColor: 'var(--noorix-accent-red)' },
  { key: 'creditCol', labelKey: 'bankMapColCredit', required: true, badgeBg: 'var(--noorix-green-15)', badgeColor: 'var(--noorix-accent-green)' },
  { key: 'balanceCol', labelKey: 'bankMapColBalance', required: false, badgeBg: 'var(--noorix-amber-18)', badgeColor: 'var(--noorix-accent-amber)' },
  { key: 'refCol', labelKey: 'bankMapColReference', required: false, badgeBg: 'var(--noorix-muted-15)', badgeColor: 'var(--noorix-text)' },
  { key: 'notesCol', labelKey: 'bankMapColNotes', required: false, badgeBg: 'var(--noorix-violet-15)', badgeColor: 'var(--noorix-accent-violet)' },
];

function normalizeDateForInput(v) {
  if (!v) return '';
  const s = String(v).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return extractDateFromCell(v).slice(0, 10) || '';
}

function emptyColumnMap() {
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

export default function BankStatementMappingModal({ statement, companyId, onClose, onConfirm, showToast }) {
  const { t } = useTranslation();
  const hasFullRaw = Array.isArray(statement?._fullRaw) && statement._fullRaw.length > 0;
  const headerAiFetchedRef = useRef(null);

  useEffect(() => {
    headerAiFetchedRef.current = null;
  }, [statement?.id]);

  const { data: fetched } = useQuery({
    queryKey: ['bank-statement-mapping', companyId, statement?.id],
    queryFn: () => bankStatementGet(companyId, statement.id),
    enabled: !!statement?.id && !!companyId && !hasFullRaw,
  });

  const resolvedStatement = hasFullRaw ? statement : (fetched?.data ?? fetched ?? statement);
  const raw = useMemo(() => {
    if (hasFullRaw && Array.isArray(statement._fullRaw)) return statement._fullRaw;
    const rd = resolvedStatement?.rawData;
    return Array.isArray(rd) ? rd : [];
  }, [statement, resolvedStatement, hasFullRaw]);

  const [companyName, setCompanyName] = useState('');
  const [bankName, setBankName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [headerRow, setHeaderRow] = useState(0);
  const [dataStartRow, setDataStartRow] = useState(1);
  const [columnMapping, setColumnMapping] = useState(emptyColumnMap);
  const [isAutoDetected, setIsAutoDetected] = useState(false);
  const [aiHeaderLoading, setAiHeaderLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dataEndRow = useMemo(() => Math.max(0, raw.length - 1), [raw.length]);

  /** مطابق القديم: autoDetectRows ثم autoDetectColumns بنفس الصفوف (تجنّب تشغيل الأعمدة بصف رأس قديم) */
  useEffect(() => {
    if (!raw?.length) return;
    const ar = autoDetectRows(raw);
    setHeaderRow(ar.headerRow);
    setDataStartRow(ar.dataStartRow);
    setCompanyName((p) => (p.trim() ? p : ar.customerName || ''));
    setBankName((p) => (p.trim() ? p : ar.bankName || ''));
    setStartDate((p) => p || normalizeDateForInput(ar.periodFrom) || '');
    setEndDate((p) => p || normalizeDateForInput(ar.periodTo) || '');
    if (!raw[ar.headerRow]) return;
    const det = autoDetectColumns(raw, ar.headerRow, ar.dataStartRow);
    setColumnMapping({
      dateCol: det.date ?? -1,
      descCol: det.description ?? -1,
      debitCol: det.debit ?? -1,
      creditCol: det.credit ?? -1,
      balanceCol: det.balance ?? -1,
      refCol: det.reference ?? -1,
      notesCol: det.notes ?? -1,
    });
    setIsAutoDetected(Object.keys(det).length >= 3);
  }, [raw, statement?.id]);

  /** مطابق InvokeLLM لترويسة الكشف */
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
        const d = res.data ?? res;
        if (d.customerName) setCompanyName((prev) => (prev && prev.trim() ? prev : d.customerName));
        if (d.bankName) setBankName((prev) => (prev && prev.trim() ? prev : d.bankName));
        if (d.periodFrom) setStartDate((prev) => prev || normalizeDateForInput(d.periodFrom));
        if (d.periodTo) setEndDate((prev) => prev || normalizeDateForInput(d.periodTo));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAiHeaderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statement?.id, companyId, raw.length]);

  const colCount = raw.length ? Math.max(...raw.map((r) => (Array.isArray(r) ? r.length : 0))) : 0;
  const headers = useMemo(() => {
    const row = raw[headerRow] || [];
    return Array.from({ length: colCount }, (_, i) => ({
      index: i,
      label: String(row[i] ?? '').trim() || `${t('bankStatementColIgnore')} ${i + 1}`,
    }));
  }, [raw, headerRow, colCount, t]);

  const previewRows = useMemo(
    () =>
      raw
        .slice(dataStartRow, dataStartRow + 8)
        .filter((r) => r && r.some((c) => c !== '' && c != null)),
    [raw, dataStartRow],
  );
  const previewTableMinWidth = useMemo(
    () => Math.max(520, (headers.length + 1) * 120),
    [headers.length],
  );

  const totalDataRows = useMemo(() => countDataRowsFrom(raw, dataStartRow), [raw, dataStartRow]);

  const getColumnBadge = useCallback(
    (colIndex) => {
      for (const def of COLUMN_FIELD_DEFS) {
        if (columnMapping[def.key] === colIndex) return def;
      }
      return null;
    },
    [columnMapping],
  );

  const setCol = (key, value) =>
    setColumnMapping((prev) => ({ ...prev, [key]: value === '' || value == null ? -1 : parseInt(value, 10) }));

  /** مطابق requiredMapped: التاريخ، الوصف، المدين، الدائن */
  const canConfirm = useMemo(() => {
    return (
      columnMapping.dateCol >= 0 &&
      columnMapping.descCol >= 0 &&
      columnMapping.debitCol >= 0 &&
      columnMapping.creditCol >= 0
    );
  }, [columnMapping]);

  const handleConfirm = async () => {
    if (!canConfirm) {
      showToast(t('bankMapRequiredWarningStrict'), 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await bankStatementConfirmMapping(statement.id, {
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
        showToast(t('bankStatementParsedCount', String(res.data.transactionCount ?? 0)));
        onConfirm();
      } else {
        showToast(res?.error || 'فشل التأكيد', 'error');
      }
    } catch (err) {
      showToast(err?.message || 'فشل التأكيد', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCell = (cell) => {
    if (cell instanceof Date) return cell.toLocaleDateString('en-CA');
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
              <div className="flex gap-1.5 text-[13px] items-center" style={{ color: 'var(--noorix-accent-amber)' }}>
                <span>⚠</span>
                <span>{t('bankMapRequiredWarningStrict')}</span>
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
            <Button variant="primary" onClick={handleConfirm} disabled={!canConfirm || isSubmitting}>
              {isSubmitting ? t('bankStatementAIApplying') : t('bankMapConfirmAnalyze')}
            </Button>
          </div>
        </div>
      }
    >
        <p className="text-[13px] text-noorix-muted m-0 mb-3.5">{t('bankMapSubtitle')}</p>

        <div
          className="rounded-lg p-3.5 mb-3.5"
          style={{
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(37, 99, 235, 0.25)',
          }}
        >
          <div className="flex items-center flex flex-wrap gap-2 mb-2.5">
            <span className="font-bold text-[13px]" style={{ color: 'var(--noorix-accent-blue)' }}>{t('bankMapStatementInfo')}</span>
            {aiHeaderLoading ? (
              <span className="text-[11px] py-px px-2 rounded-md" style={{ background: 'color-mix(in srgb, var(--noorix-accent-blue) 12%, var(--noorix-bg-surface))', color: 'var(--noorix-accent-blue)' }}>
                {t('bankMapAiReading')}
              </span>
            ) : null}
            <span className="ms-auto text-[11px] py-px px-2 rounded-md border border-noorix-border" style={{ background: 'var(--noorix-bg-surface)' }}>
              {totalDataRows} {t('bankMapOperationsCount')}
            </span>
            <span className="text-[11px] py-px px-2 rounded-md border border-noorix-border" style={{ background: 'var(--noorix-bg-surface)' }}>
              {t('bankMapHeaderRowBadge', String(headerRow + 1))}
            </span>
            {isAutoDetected ? (
              <span className="text-[11px] py-px px-2 rounded-md" style={{ background: 'color-mix(in srgb, var(--noorix-accent-green) 12%, var(--noorix-bg-surface))', color: 'var(--noorix-accent-green)' }}>
                ✓ {t('bankMapColumnsDetected')}
              </span>
            ) : null}
          </div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            <Input
              type="text"
              label={t('bankMapCustomerLabel')}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t('bankMapCustomerPlaceholder')}
            />
            <Input
              type="text"
              label={t('bankMapBankLabel')}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder={t('bankMapBankPlaceholder')}
            />
            <Input
              type="date"
              label={t('bankMapPeriodFrom')}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="date"
              label={t('bankMapPeriodTo')}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {!Object.values(columnMapping).some((v) => typeof v === 'number' && v >= 0) && raw.length > 0 ? (
          <div
            className="rounded-lg text-[13px] mb-3 p-[10px]"
            style={{
              background: 'var(--noorix-yellow-12)',
              border: '1px solid var(--noorix-yellow-35)',
            }}
          >
            {t('bankStatementNoAutoDetect')}
          </div>
        ) : null}

        <div className="border border-noorix-border rounded-lg p-3.5 mb-[14px]">
          <div className="text-[14px] font-bold mb-2.5">{t('bankStatementMapColumns')}</div>
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            }}
          >
            {COLUMN_FIELD_DEFS.map((col) => (
              <div key={col.key}>
                <label className="flex items-center gap-6 text-[12px] font-semibold mb-1">
                  <span>
                    {t(col.labelKey)}
                    {col.required ? <span style={{ color: 'var(--noorix-error)' }}> *</span> : null}
                  </span>
                  {columnMapping[col.key] >= 0 ? <span className="text-noorix-green">✓</span> : null}
                </label>
                <Input
                  type="select"
                  value={columnMapping[col.key] >= 0 ? columnMapping[col.key] : ''}
                  onChange={(e) => setCol(col.key, e.target.value)}
                >
                  <option value="">{t('bankMapSelectColumn')}</option>
                  {Array.from({ length: colCount }, (_, i) => (
                    <option key={i} value={i}>
                      {headers[i]?.label?.slice(0, 55) || i + 1}
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
            <span className="font-normal text-[12px]" style={{ color: 'var(--noorix-text-muted)' }}>{t('bankMapPreviewHint')}</span>
          </div>
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full border-collapse text-[12px]" style={{ minWidth: previewTableMinWidth }}>
              <thead>
                <tr style={{ background: 'var(--noorix-bg-muted)' }}>
                  <th className="py-2 px-1.5 w-9">#</th>
                  {headers.map((h) => {
                    const badge = getColumnBadge(h.index);
                    return (
                      <th key={h.index} className="py-2 px-1.5 text-start align-top min-w-[100px]">
                        <div className="font-semibold">{h.label}</div>
                        {badge ? (
                          <div
                            className="mt-1 text-[10px] font-bold py-px px-1.5 rounded inline-block"
                            style={{
                              background: badge.badgeBg,
                              color: badge.badgeColor,
                            }}
                          >
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
                  <tr key={rowIdx} style={{ borderTop: '1px solid var(--noorix-border)' }}>
                    <td className="p-1.5 text-noorix-muted">{rowIdx + 1}</td>
                    {headers.map((h) => {
                      const badge = getColumnBadge(h.index);
                      return (
                        <td
                          key={h.index}
                          className="p-1.5 max-w-[140px]"
                          style={{
                            fontWeight: badge ? 600 : 400,
                            background: badge ? badge.badgeBg.replace('0.15', '0.06').replace('0.18', '0.08') : undefined,
                          }}
                        >
                          {formatCell(row[h.index])}
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

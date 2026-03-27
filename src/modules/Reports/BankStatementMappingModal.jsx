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
import {
  autoDetectRows,
  autoDetectColumns,
  countDataRowsFrom,
  extractDateFromCell,
} from './bank/bankMappingAutoDetect';

/** مطابق COLUMN_TYPES في Base44 (بدون amount) */
const COLUMN_FIELD_DEFS = [
  { key: 'dateCol', labelKey: 'bankMapColDate', required: true, badgeBg: 'rgba(37,99,235,0.18)', badgeColor: '#1d4ed8' },
  { key: 'descCol', labelKey: 'bankMapColDescription', required: true, badgeBg: 'rgba(126,34,206,0.15)', badgeColor: '#6b21a8' },
  { key: 'debitCol', labelKey: 'bankMapColDebit', required: true, badgeBg: 'rgba(220,38,38,0.15)', badgeColor: '#b91c1c' },
  { key: 'creditCol', labelKey: 'bankMapColCredit', required: true, badgeBg: 'rgba(22,163,74,0.15)', badgeColor: '#15803d' },
  { key: 'balanceCol', labelKey: 'bankMapColBalance', required: false, badgeBg: 'rgba(217,119,6,0.18)', badgeColor: '#b45309' },
  { key: 'refCol', labelKey: 'bankMapColReference', required: false, badgeBg: 'rgba(75,85,99,0.15)', badgeColor: '#374151' },
  { key: 'notesCol', labelKey: 'bankMapColNotes', required: false, badgeBg: 'rgba(79,70,229,0.15)', badgeColor: '#4338ca' },
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
    <div
      className="noorix-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 12,
      }}
    >
      <div
        className="noorix-surface-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(960px, 98vw)',
          maxHeight: '92vh',
          overflow: 'auto',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{t('bankMapTitle')}</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('bankMapSubtitle')}</p>
          </div>
          <button type="button" className="noorix-btn noorix-btn--ghost" onClick={onClose} aria-label="إغلاق">
            ← {t('cancel')}
          </button>
        </div>

        <div
          style={{
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(37, 99, 235, 0.25)',
            borderRadius: 10,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#1e40af' }}>{t('bankMapStatementInfo')}</span>
            {aiHeaderLoading ? (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#dbeafe', color: '#1d4ed8' }}>
                {t('bankMapAiReading')}
              </span>
            ) : null}
            <span style={{ marginInlineStart: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#fff', border: '1px solid var(--noorix-border)' }}>
              📄 {totalDataRows} {t('bankMapOperationsCount')}
            </span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#fff', border: '1px solid var(--noorix-border)' }}>
              {t('bankMapHeaderRowBadge', String(headerRow + 1))}
            </span>
            {isAutoDetected ? (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#dcfce7', color: '#166534' }}>
                ✓ {t('bankMapColumnsDetected')}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            <label>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{t('bankMapCustomerLabel')}</span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t('bankMapCustomerPlaceholder')}
                style={{ width: '100%', marginTop: 4, padding: '8px 10px', fontSize: 13 }}
              />
            </label>
            <label>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{t('bankMapBankLabel')}</span>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder={t('bankMapBankPlaceholder')}
                style={{ width: '100%', marginTop: 4, padding: '8px 10px', fontSize: 13 }}
              />
            </label>
            <label>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{t('bankMapPeriodFrom')}</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </label>
            <label>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{t('bankMapPeriodTo')}</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </label>
          </div>
        </div>

        {!Object.values(columnMapping).some((v) => typeof v === 'number' && v >= 0) && raw.length > 0 ? (
          <div
            style={{
              padding: 10,
              background: 'rgba(234,179,8,0.12)',
              border: '1px solid rgba(234,179,8,0.35)',
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {t('bankStatementNoAutoDetect')}
          </div>
        ) : null}

        <div style={{ border: '1px solid var(--noorix-border)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t('bankStatementMapColumns')}</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {COLUMN_FIELD_DEFS.map((col) => (
              <div key={col.key}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  <span>
                    {t(col.labelKey)}
                    {col.required ? <span style={{ color: 'var(--noorix-error)' }}> *</span> : null}
                  </span>
                  {columnMapping[col.key] >= 0 ? <span style={{ color: '#16a34a' }}>✓</span> : null}
                </label>
                <select
                  value={columnMapping[col.key] >= 0 ? columnMapping[col.key] : ''}
                  onChange={(e) => setCol(col.key, e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
                >
                  <option value="">{t('bankMapSelectColumn')}</option>
                  {Array.from({ length: colCount }, (_, i) => (
                    <option key={i} value={i}>
                      {headers[i]?.label?.slice(0, 55) || i + 1}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: '1px solid var(--noorix-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '10px 12px', background: 'var(--noorix-bg-muted)', borderBottom: '1px solid var(--noorix-border)', fontWeight: 600, fontSize: 13 }}>
            {t('bankMapPreviewTitle')}{' '}
            <span style={{ fontWeight: 400, color: 'var(--noorix-text-muted)', fontSize: 12 }}>{t('bankMapPreviewHint')}</span>
          </div>
          <div style={{ overflow: 'auto', maxHeight: 300 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--noorix-bg-muted)' }}>
                  <th style={{ padding: '8px 6px', width: 36 }}>#</th>
                  {headers.map((h) => {
                    const badge = getColumnBadge(h.index);
                    return (
                      <th key={h.index} style={{ padding: '8px 6px', textAlign: 'start', verticalAlign: 'top', minWidth: 100 }}>
                        <div style={{ fontWeight: 600 }}>{h.label}</div>
                        {badge ? (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              display: 'inline-block',
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
                    <td style={{ padding: '6px', color: 'var(--noorix-text-muted)' }}>{rowIdx + 1}</td>
                    {headers.map((h) => {
                      const badge = getColumnBadge(h.index);
                      return (
                        <td
                          key={h.index}
                          style={{
                            padding: '6px',
                            maxWidth: 140,
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

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            {!canConfirm ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#b45309' }}>
                <span>⚠</span>
                <span>{t('bankMapRequiredWarningStrict')}</span>
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="noorix-btn noorix-btn--ghost" onClick={onClose}>
              {t('cancel')}
            </button>
            <button
              type="button"
              className="noorix-btn noorix-btn--primary"
              onClick={handleConfirm}
              disabled={!canConfirm || isSubmitting}
            >
              {isSubmitting ? t('bankStatementAIApplying') : t('bankMapConfirmAnalyze')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

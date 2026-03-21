/**
 * BankStatementMappingModal — ربط الأعمدة وتأكيد الاستخراج
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { bankStatementConfirmMapping, bankStatementGet } from '../../services/api';

const COL_TYPES = [
  { key: 'dateCol', labelKey: 'bankStatementColDate', required: true },
  { key: 'descCol', labelKey: 'bankStatementColDescription', required: false },
  { key: 'debitCol', labelKey: 'bankStatementColDebit', required: false },
  { key: 'creditCol', labelKey: 'bankStatementColCredit', required: false },
  { key: 'balanceCol', labelKey: 'bankStatementColBalance', required: false },
];

export default function BankStatementMappingModal({ statement, companyId, categories, onClose, onConfirm, showToast }) {
  const { t } = useTranslation();
  const hasFullRaw = Array.isArray(statement?._fullRaw) && statement._fullRaw.length > 0;

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

  const base = resolvedStatement ?? statement;
  const [companyName, setCompanyName] = useState(base?.companyName ?? '');
  const [bankName, setBankName] = useState(base?.bankName ?? '');
  const [startDate, setStartDate] = useState(base?.startDate?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(base?.endDate?.slice(0, 10) ?? '');
  const [headerRow, setHeaderRow] = useState(base?.headerRow ?? 0);
  const [dataStartRow, setDataStartRow] = useState(base?.dataStartRow ?? 1);
  const [dataEndRow, setDataEndRow] = useState(base?.dataEndRow ?? Math.max(0, raw.length - 1));
  const [columnMapping, setColumnMapping] = useState(() => ({
    dateCol: base?.columnMapping?.dateCol ?? -1,
    descCol: base?.columnMapping?.descCol ?? -1,
    debitCol: base?.columnMapping?.debitCol ?? -1,
    creditCol: base?.columnMapping?.creditCol ?? -1,
    balanceCol: base?.columnMapping?.balanceCol ?? -1,
  }));

  useEffect(() => {
    if (!resolvedStatement || (raw.length === 0 && !hasFullRaw)) return;
    setCompanyName(resolvedStatement.companyName ?? '');
    setBankName(resolvedStatement.bankName ?? '');
    setStartDate(resolvedStatement.startDate?.slice(0, 10) ?? '');
    setEndDate(resolvedStatement.endDate?.slice(0, 10) ?? '');
    setHeaderRow(resolvedStatement.headerRow ?? 0);
    setDataStartRow(resolvedStatement.dataStartRow ?? 1);
    setDataEndRow(Math.max(resolvedStatement.dataEndRow ?? 0, raw.length - 1));
    setColumnMapping({
      dateCol: resolvedStatement.columnMapping?.dateCol ?? -1,
      descCol: resolvedStatement.columnMapping?.descCol ?? -1,
      debitCol: resolvedStatement.columnMapping?.debitCol ?? -1,
      creditCol: resolvedStatement.columnMapping?.creditCol ?? -1,
      balanceCol: resolvedStatement.columnMapping?.balanceCol ?? -1,
    });
  }, [resolvedStatement, raw.length, hasFullRaw]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const colCount = raw.length ? Math.max(...raw.map((r) => (Array.isArray(r) ? r.length : 0))) : 0;
  const previewRows = raw.slice(0, Math.min(15, raw.length));

  const setCol = (key, value) =>
    setColumnMapping((prev) => ({ ...prev, [key]: value === '' || value == null ? -1 : parseInt(value, 10) }));

  const canConfirm =
    columnMapping.dateCol >= 0 && (columnMapping.debitCol >= 0 || columnMapping.creditCol >= 0);

  const handleConfirm = async () => {
    if (!canConfirm) {
      showToast(t('bankStatementMappingRequiredFields') || 'حدد عمود التاريخ وعمود المدين أو الدائن', 'error');
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
        columnMapping,
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

  return (
    <div
      className="noorix-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="noorix-surface-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 95vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t('bankStatementColumnMapping')}</h2>
          <button type="button" className="noorix-btn noorix-btn--ghost" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankStatementCompanyName')}</span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
            <label>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankStatementBankName')}</span>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="مثال: الراجحي"
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <label>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankStatementHeaderRow')}</span>
              <input
                type="number"
                min={0}
                value={headerRow}
                onChange={(e) => setHeaderRow(parseInt(e.target.value, 10) || 0)}
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
            <label>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankStatementDataStartRow')}</span>
              <input
                type="number"
                min={0}
                value={dataStartRow}
                onChange={(e) => setDataStartRow(parseInt(e.target.value, 10) || 0)}
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
            <label>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankStatementDataEndRow')}</span>
              <input
                type="number"
                min={0}
                value={dataEndRow}
                onChange={(e) => setDataEndRow(parseInt(e.target.value, 10) || 0)}
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
            <label>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankStatementDateRange')}</span>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ flex: 1 }} />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ flex: 1 }} />
              </div>
            </label>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('bankStatementMapColumns')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(auto-fill, minmax(80px, 1fr))', gap: 8, alignItems: 'center' }}>
              {COL_TYPES.map((col) => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {t(col.labelKey)}
                    {col.required && <span style={{ color: 'var(--noorix-error)' }}> *</span>}
                  </span>
                  <select
                    value={columnMapping[col.key] >= 0 ? columnMapping[col.key] : ''}
                    onChange={(e) => setCol(col.key, e.target.value)}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <option value="">—</option>
                    {Array.from({ length: colCount }, (_, i) => (
                      <option key={i} value={i}>
                        {i + 1} ({raw[0]?.[i] ?? ''})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('bankStatementPreview')}</div>
            <div style={{ overflow: 'auto', maxHeight: 220, border: '1px solid var(--noorix-border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--noorix-bg-muted)' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'start' }}>#</th>
                    {Array.from({ length: colCount }, (_, i) => (
                      <th key={i} style={{ padding: '6px 8px', textAlign: 'start', whiteSpace: 'nowrap' }}>
                        {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} style={{ borderTop: '1px solid var(--noorix-border)' }}>
                      <td style={{ padding: '4px 8px', color: 'var(--noorix-text-muted)' }}>{ri + 1}</td>
                      {Array.from({ length: colCount }, (_, ci) => (
                        <td key={ci} style={{ padding: '4px 8px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {String(row[ci] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" className="noorix-btn noorix-btn--ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="noorix-btn noorix-btn--primary"
            onClick={handleConfirm}
            disabled={!canConfirm || isSubmitting}
          >
            {isSubmitting ? t('bankStatementAIApplying') : t('bankStatementConfirmMapping')}
          </button>
        </div>
      </div>
    </div>
  );
}

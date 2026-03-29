/**
 * نافذة تفاصيل فئة من مخطط الدائري — جدول عمليات + تغيير الفئة
 */
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fmt } from '../../../utils/format';
import { getTxKey, FALLBACK_CATEGORIES } from './bankAnalysisUtils';

export default function BankStatementPieDrilldownModal({
  open,
  onClose,
  categoryName,
  transactions,
  categories,
  uncategorizedLabel,
  t,
  onSaveTxCategory,
  showToast,
}) {
  const [editingTxId, setEditingTxId] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState('');

  useEffect(() => {
    if (!open) {
      setEditingTxId(null);
      setEditingCategoryId('');
    }
  }, [open]);

  const rows = useMemo(() => {
    if (!categoryName || !transactions?.length) return [];
    return transactions.filter((tx) => {
      const n = tx.category?.nameAr || tx.category?.nameEn || uncategorizedLabel;
      return n === categoryName;
    });
  }, [transactions, categoryName, uncategorizedLabel]);

  const allCategoryOptions = useMemo(() => {
    const fromDb = (categories || []).map((c) => ({ id: c.id, label: c.nameAr || c.nameEn }));
    if (fromDb.length > 0) return fromDb;
    return FALLBACK_CATEGORIES.map((name) => ({ id: name, label: name }));
  }, [categories]);

  const totals = useMemo(() => {
    let d = 0;
    let c = 0;
    for (const tx of rows) {
      d += Number(tx.debit) || 0;
      c += Number(tx.credit) || 0;
    }
    return { debit: d, credit: c };
  }, [rows]);

  if (!open || !categoryName) return null;

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={categoryName}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        zIndex: 10060,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="noorix-surface-card"
        style={{
          width: 'min(920px, 100%)',
          maxHeight: 'min(85vh, 720px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 16,
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--noorix-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexShrink: 0,
            background: 'var(--noorix-bg-muted)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('bankPieDrilldownTitle')}</h3>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6, color: 'var(--noorix-accent-blue)' }}>{categoryName}</div>
            <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              <span>
                {t('bankStatementTransactions')}: <strong>{rows.length}</strong>
              </span>
              <span style={{ color: '#dc2626' }}>
                {t('bankStatementColDebit')}: <strong style={{ direction: 'ltr', display: 'inline-block' }}>{fmt(totals.debit)}</strong>
              </span>
              <span style={{ color: '#16a34a' }}>
                {t('bankStatementColCredit')}: <strong style={{ direction: 'ltr', display: 'inline-block' }}>{fmt(totals.credit)}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            className="noorix-btn noorix-btn--ghost"
            onClick={onClose}
            style={{ fontSize: 20, lineHeight: 1, padding: '4px 10px' }}
            aria-label={t('close') || 'Close'}
          >
            ×
          </button>
        </div>

        <div style={{ overflow: 'auto', flex: 1, padding: '12px 16px' }}>
          {rows.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--noorix-text-muted)', padding: 24 }}>{t('bankPieDrilldownEmpty')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--noorix-bg-muted)', borderBottom: '2px solid var(--noorix-border)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>{t('bankStatementDate')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>{t('bankStatementDescription')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>{t('bankStatementColDebit')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>{t('bankStatementColCredit')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', minWidth: 200 }}>{t('bankStatementCategories')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx, i) => {
                  const k = getTxKey(tx);
                  const catId = tx.categoryId || '';
                  return (
                    <tr key={k} style={{ borderBottom: '1px solid var(--noorix-border)', background: i % 2 ? 'var(--noorix-bg-muted)' : 'transparent' }}>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--noorix-text-muted)' }}>{tx.txDate}</td>
                      <td style={{ padding: '8px 10px', maxWidth: 260 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.description}>
                          {tx.description}
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', direction: 'ltr', color: Number(tx.debit) > 0 ? '#dc2626' : 'var(--noorix-text-muted)' }}>
                        {Number(tx.debit) > 0 ? fmt(Number(tx.debit)) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', direction: 'ltr', color: Number(tx.credit) > 0 ? '#16a34a' : 'var(--noorix-text-muted)' }}>
                        {Number(tx.credit) > 0 ? fmt(Number(tx.credit)) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {editingTxId === tx.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <select
                              value={editingCategoryId}
                              onChange={(e) => setEditingCategoryId(e.target.value)}
                              style={{ fontSize: 11, padding: 6, borderRadius: 8, border: '1px solid var(--noorix-border)', maxWidth: '100%' }}
                            >
                              <option value="">{uncategorizedLabel}</option>
                              {allCategoryOptions.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="noorix-btn noorix-btn--primary"
                                style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={async () => {
                                  try {
                                    await onSaveTxCategory(tx.id, editingCategoryId || null);
                                    setEditingTxId(null);
                                    showToast?.(t('savedSuccessfully') || 'OK');
                                  } catch (e) {
                                    showToast?.(e?.message || 'Error', 'error');
                                  }
                                }}
                              >
                                {t('save')}
                              </button>
                              <button type="button" className="noorix-btn noorix-btn--ghost" style={{ fontSize: 11 }} onClick={() => setEditingTxId(null)}>
                                {t('cancel')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="noorix-btn noorix-btn--ghost"
                            style={{ fontSize: 11, textAlign: 'right', maxWidth: '100%' }}
                            onClick={() => {
                              setEditingTxId(tx.id);
                              setEditingCategoryId(catId);
                            }}
                          >
                            {tx.category?.nameAr || tx.category?.nameEn || uncategorizedLabel}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--noorix-border)', flexShrink: 0 }}>
          <button type="button" className="noorix-btn noorix-btn--secondary" onClick={onClose}>
            {t('close') || 'إغلاق'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}

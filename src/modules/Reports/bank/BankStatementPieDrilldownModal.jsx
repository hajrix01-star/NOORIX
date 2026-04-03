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
        background: 'rgba(0, 0, 0, 0.55)',
        zIndex: 10060,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: 'min(960px, 100%)',
          maxHeight: 'min(88vh, 760px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 18,
          boxShadow: '0 32px 64px rgba(0,0,0,0.28)',
          background: 'var(--noorix-bg-surface)',
          border: '1px solid var(--noorix-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* رأس النافذة */}
        <div
          style={{
            padding: '18px 24px 16px',
            borderBottom: '1px solid var(--noorix-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexShrink: 0,
            background: 'var(--noorix-bg-surface)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--noorix-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('bankPieDrilldownTitle')}
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--noorix-text)' }}>{categoryName}</h3>
            <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--noorix-text-muted)', display: 'inline-block' }} />
                {t('bankStatementTransactions')}: <strong style={{ color: 'var(--noorix-text)' }}>{rows.length}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                {t('bankStatementColDebit')}: <strong style={{ direction: 'ltr', display: 'inline-block', color: '#dc2626' }}>{fmt(totals.debit)}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                {t('bankStatementColCredit')}: <strong style={{ direction: 'ltr', display: 'inline-block', color: '#16a34a' }}>{fmt(totals.credit)}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--noorix-border)',
              background: 'var(--noorix-bg-muted)',
              color: 'var(--noorix-text-muted)',
              fontSize: 18, lineHeight: 1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label={t('close') || 'Close'}
          >
            ×
          </button>
        </div>

        <div style={{ overflow: 'auto', flex: 1 }}>
          {rows.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--noorix-text-muted)', padding: 40 }}>{t('bankPieDrilldownEmpty')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: 'var(--noorix-bg-muted)', borderBottom: '2px solid var(--noorix-border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--noorix-text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{t('bankStatementDate')}</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--noorix-text-muted)', fontSize: 11 }}>{t('bankStatementDescription')}</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--noorix-text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{t('bankStatementColDebit')}</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--noorix-text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{t('bankStatementColCredit')}</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--noorix-text-muted)', fontSize: 11, minWidth: 200, whiteSpace: 'nowrap' }}>{t('bankStatementCategories')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx, i) => {
                  const k = getTxKey(tx);
                  const catId = tx.categoryId || '';
                  return (
                    <tr key={k} style={{ borderBottom: '1px solid var(--noorix-border)', background: i % 2 === 0 ? 'var(--noorix-bg-surface)' : 'var(--noorix-bg-muted)' }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--noorix-text-muted)', fontSize: 12 }}>{tx.txDate}</td>
                      <td style={{ padding: '10px 14px', maxWidth: 280 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--noorix-text)' }} title={tx.description}>
                          {tx.description}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', direction: 'ltr', fontWeight: Number(tx.debit) > 0 ? 700 : 400, color: Number(tx.debit) > 0 ? '#dc2626' : 'var(--noorix-text-muted)' }}>
                        {Number(tx.debit) > 0 ? fmt(Number(tx.debit)) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', direction: 'ltr', fontWeight: Number(tx.credit) > 0 ? 700 : 400, color: Number(tx.credit) > 0 ? '#16a34a' : 'var(--noorix-text-muted)' }}>
                        {Number(tx.credit) > 0 ? fmt(Number(tx.credit)) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
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

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--noorix-border)', flexShrink: 0, background: 'var(--noorix-bg-surface)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="noorix-btn noorix-btn--secondary" onClick={onClose} style={{ minWidth: 100 }}>
            {t('close') || 'إغلاق'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}

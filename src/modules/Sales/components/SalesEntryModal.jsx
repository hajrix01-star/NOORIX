/**
 * SalesEntryModal — نافذة إدخال ملخص المبيعات اليومي
 * على الديسك توب: نافذة منبثقة مركزية
 * على الجوال: Bottom Sheet من الأسفل
 */
import React, { useState, useMemo, useEffect } from 'react';
import Decimal from 'decimal.js';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { splitTaxFromTotal } from '../../../utils/math-engine';
import { sumObjectValues } from '../../../utils/math-engine';
import { getSaudiToday } from '../../../utils/saudiDate';

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
};

export function SalesEntryModal({
  companyId,
  salesChannels,
  vatEnabled = false,
  vatRate = 0.15,
  createSummary,
  onSuccess,
  onError,
  onClose,
  onWhatsApp,
  autoCloseOnSuccess = true,
}) {
  const { t, lang } = useTranslation();
  const [txDate, setTxDate] = useState(getSaudiToday());
  const [customerCount, setCustomerCount] = useState('');
  const [cashOnHand, setCashOnHand] = useState('');
  const [notes, setNotes] = useState('');
  const [channelAmounts, setChannelAmounts] = useState({});
  const [savedSummary, setSavedSummary] = useState(null);

  useEffect(() => {
    setTxDate(getSaudiToday());
    setChannelAmounts({});
  }, [companyId]);

  const totalAmount = useMemo(() => sumObjectValues(channelAmounts), [channelAmounts]);
  const avgPerCustomer = useMemo(() => {
    const cc = parseInt(customerCount, 10) || 0;
    if (cc <= 0 || totalAmount.lte(0)) return new Decimal(0);
    return totalAmount.div(cc);
  }, [totalAmount, customerCount]);
  const { net: totalNet, tax: totalTax } = useMemo(
    () => splitTaxFromTotal(totalAmount, vatEnabled, vatRate),
    [totalAmount, vatEnabled, vatRate],
  );

  function resetForm() {
    setTxDate(getSaudiToday());
    setCustomerCount('');
    setCashOnHand('');
    setNotes('');
    setChannelAmounts({});
    setSavedSummary(null);
  }

  function handleSave() {
    if (!companyId || createSummary.isPending) return;
    const cc = parseInt(customerCount, 10) || 0;
    if (cc <= 0) return;
    const channels = salesChannels
      .filter((v) => parseFloat(channelAmounts[v.id]) > 0)
      .map((v) => ({ vaultId: v.id, amount: channelAmounts[v.id] }));
    const idempotencyKey = `sales-${companyId}-${txDate}-${Date.now()}`;
    createSummary.mutate(
      {
        companyId,
        transactionDate: txDate,
        customerCount: parseInt(customerCount, 10) || 0,
        cashOnHand: cashOnHand || '0',
        channels,
        notes: notes.trim() || undefined,
        idempotencyKey,
      },
      {
        onSuccess: (res) => {
          const data = res?.data ?? res;
          const summary = data?.summary ?? data;
          if (autoCloseOnSuccess) {
            onSuccess?.(summary);
            onClose?.();
          } else {
            setSavedSummary(summary);
            onSuccess?.(summary);
          }
        },
        onError: (e) => onError?.(e?.message),
      },
    );
  }

  if (savedSummary) {
    return (
      <div
        className="noorix-modal-overlay sales-entry-modal-overlay"
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
        onClick={(e) => e.target === e.currentTarget && (resetForm(), onClose?.())}
      >
        <div
          className="noorix-sales-entry-modal noorix-sales-entry-modal--success"
          style={{
            background: 'var(--noorix-bg-surface)', borderRadius: 16,
            width: '100%', maxWidth: 480, maxHeight: '90vh',
            overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ textAlign: 'center', padding: '24px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>{t('summarySaved')}</h3>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--noorix-text-muted)' }}>
              {t('summaryNumber')}: <strong style={{ color: 'var(--noorix-accent-blue)' }}>{savedSummary.summaryNumber}</strong>
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('total')}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#16a34a', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(savedSummary.totalAmount, 2)} ﷼</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{t('customers')}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#2563eb' }}>{savedSummary.customerCount}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <button type="button" className="noorix-btn-nav noorix-btn-success" style={{ padding: '12px 28px', fontSize: 15, width: '100%', maxWidth: 280 }} onClick={() => onWhatsApp?.(savedSummary)}>
                📱 {t('sendWhatsApp')} — {t('salesDailySummary')}
              </button>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button type="button" className="noorix-btn-nav" onClick={() => { resetForm(); onClose?.(); }}>{t('addNewSummary')}</button>
                <button type="button" className="noorix-btn-nav" onClick={() => { onClose?.(); resetForm(); }}>{t('close')}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="noorix-modal-overlay sales-entry-modal-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="noorix-sales-entry-modal"
        style={{
          background: 'var(--noorix-bg-surface)', borderRadius: 16,
          width: '100%', maxWidth: 560, maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* هيدر ثابت */}
        <div style={{ flexShrink: 0, padding: '16px 20px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t('dailySummaryInput')}</h3>
          <button type="button" className="noorix-btn-nav" onClick={onClose} style={{ padding: '6px 12px' }}>✕ {t('cancel')}</button>
        </div>

        {/* محتوى قابل للتمرير */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, paddingBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{t('transactionDate')}</label>
              <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{t('customerCount')} *</label>
              <input type="number" min="0" required value={customerCount} onChange={(e) => setCustomerCount(e.target.value)} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{t('cashOnHand')}</label>
              <input type="number" min="0" step="0.01" value={cashOnHand} onChange={(e) => setCashOnHand(e.target.value)} placeholder="0.00" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t('salesChannels')}</label>
            {salesChannels.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--noorix-text-muted)', border: '2px dashed var(--noorix-border)', borderRadius: 10, fontSize: 13 }}>
                {t('noSalesChannels')}
              </div>
            ) : (
              <div className="sales-channels-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {salesChannels.map((v) => {
                  const amt = channelAmounts[v.id] || '';
                  return (
                    <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--noorix-text-muted)' }}>{vaultDisplayName(v, lang)}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amt}
                        onChange={(e) => setChannelAmounts((p) => ({ ...p, [v.id]: e.target.value }))}
                        placeholder="0.00"
                        style={{ padding: '8px 10px', borderRadius: 8, fontSize: 14, fontFamily: 'var(--noorix-font-numbers)', textAlign: 'right', border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)' }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{t('notes')}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('notesPlaceholder')} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div className={`noorix-summary-bar noorix-summary-bar--${vatEnabled && totalAmount.gt(0) ? '5' : '3'}`} style={{ marginBottom: 8 }}>
            <div className="noorix-summary-bar__item">
              <div className="noorix-summary-bar__label">{t('totalLabel')}</div>
              <div className="noorix-summary-bar__value noorix-summary-bar__value--green">{fmt(totalAmount, 2)} ﷼</div>
            </div>
            {vatEnabled && totalAmount.gt(0) && (
              <>
                <div className="noorix-summary-bar__item">
                  <div className="noorix-summary-bar__label">الصافي</div>
                  <div className="noorix-summary-bar__value noorix-summary-bar__value--blue">{fmt(totalNet, 2)} ﷼</div>
                </div>
                <div className="noorix-summary-bar__item">
                  <div className="noorix-summary-bar__label">الضريبة</div>
                  <div className="noorix-summary-bar__value noorix-summary-bar__value--amber">{fmt(totalTax, 2)} ﷼</div>
                </div>
              </>
            )}
            <div className="noorix-summary-bar__item">
              <div className="noorix-summary-bar__label">{t('customersLabel')}</div>
              <div className="noorix-summary-bar__value noorix-summary-bar__value--blue">{customerCount || 0}</div>
            </div>
            <div className="noorix-summary-bar__item">
              <div className="noorix-summary-bar__label">{t('avgPerOrder')}</div>
              <div className="noorix-summary-bar__value">{fmt(avgPerCustomer, 2)} ﷼</div>
            </div>
          </div>
        </div>

        {/* زر حفظ ثابت في الأسفل */}
        <div style={{ flexShrink: 0, padding: '16px 20px', borderTop: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="noorix-btn-nav noorix-btn-success"
              disabled={createSummary.isPending || totalAmount.lte(0) || salesChannels.length === 0 || !customerCount || parseInt(customerCount, 10) <= 0}
              onClick={handleSave}
              style={{ flex: 1, padding: '12px 16px', fontSize: 15 }}
            >
              {createSummary.isPending ? t('saving') : t('saveSummary')}
            </button>
            <button type="button" className="noorix-btn-nav" onClick={resetForm}>{t('reset')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

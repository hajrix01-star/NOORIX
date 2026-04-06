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
import { Button, Input, Modal } from '../../../ui';

export function SalesEntryModal({
  companyId,
  salesChannels,
  salesChannelsLoading = false,
  salesChannelsError = '',
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
      <Modal
        open={true}
        onClose={() => { resetForm(); onClose?.(); }}
        title={t('summarySaved')}
        size="sm"
        footer={
          <>
            <Button onClick={() => { resetForm(); onClose?.(); }}>{t('addNewSummary')}</Button>
            <Button variant="ghost" onClick={() => { onClose?.(); resetForm(); }}>{t('close')}</Button>
          </>
        }
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
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
          <Button
            variant="success"
            style={{ width: '100%', maxWidth: 280 }}
            onClick={() => onWhatsApp?.(savedSummary)}
          >
            {t('sendWhatsApp')} — {t('salesDailySummary')}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={t('dailySummaryInput')}
      size="md"
      footer={
        <>
          <Button
            variant="success"
            disabled={createSummary.isPending || salesChannelsLoading || !!salesChannelsError || totalAmount.lte(0) || salesChannels.length === 0 || !customerCount || parseInt(customerCount, 10) <= 0}
            onClick={handleSave}
            style={{ flex: 1 }}
          >
            {createSummary.isPending ? t('saving') : t('saveSummary')}
          </Button>
          <Button onClick={resetForm}>{t('reset')}</Button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14, marginBottom: 18 }}>
        <Input type="date" label={t('transactionDate')} value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        <Input type="number" min="0" label={t('customerCount')} required value={customerCount} onChange={(e) => setCustomerCount(e.target.value)} placeholder="0" />
        <Input type="number" min="0" step="0.01" label={t('cashOnHand')} value={cashOnHand} onChange={(e) => setCashOnHand(e.target.value)} placeholder="0.00" />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t('salesChannels')}</label>
        {salesChannelsLoading ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--noorix-text-muted)', border: '2px dashed var(--noorix-border)', borderRadius: 10, fontSize: 13 }}>
            {t('loading')}
          </div>
        ) : salesChannelsError ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#b91c1c', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
            {salesChannelsError}
          </div>
        ) : salesChannels.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--noorix-text-muted)', border: '2px dashed var(--noorix-border)', borderRadius: 10, fontSize: 13 }}>
            {t('noSalesChannels')}
          </div>
        ) : (
          <div className="sales-channels-grid" style={{ display: 'grid', gap: 8 }}>
            {salesChannels.map((v) => {
              const amt = channelAmounts[v.id] || '';
              return (
                <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--noorix-text-muted)' }}>{vaultDisplayName(v, lang)}</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amt}
                    onChange={(e) => setChannelAmounts((p) => ({ ...p, [v.id]: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, fontSize: 14, fontFamily: 'var(--noorix-font-numbers)', textAlign: 'right', border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)' }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <Input multiline label={t('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('notesPlaceholder')} style={{ resize: 'vertical' }} />
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
    </Modal>
  );
}

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
        <div className="nx-text-center">
          <div className="nx-mb-12" style={{ fontSize: 48 }}>✅</div>
          <p className="nx-text-md nx-text-muted nx-m-0 nx-mb-16">
            {t('summaryNumber')}: <strong style={{ color: 'var(--noorix-accent-blue)' }}>{savedSummary.summaryNumber}</strong>
          </p>
          <div className="nx-flex nx-flex-wrap nx-gap-16 nx-mb-20" style={{ justifyContent: 'center' }}>
            <div className="nx-text-center">
              <div className="nx-text-xs nx-text-muted">{t('total')}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#16a34a', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(savedSummary.totalAmount, 2)} ﷼</div>
            </div>
            <div className="nx-text-center">
              <div className="nx-text-xs nx-text-muted">{t('customers')}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#2563eb' }}>{savedSummary.customerCount}</div>
            </div>
          </div>
          <Button
            variant="success"
            className="nx-w-full"
            style={{ maxWidth: 280 }}
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
      size="xl"
      footer={
        <>
          <Button
            variant="primary"
            disabled={createSummary.isPending || salesChannelsLoading || !!salesChannelsError || totalAmount.lte(0) || salesChannels.length === 0 || !customerCount || parseInt(customerCount, 10) <= 0}
            onClick={handleSave}
            className="nx-flex-1"
          >
            {createSummary.isPending ? t('saving') : t('saveSummary')}
          </Button>
          <Button onClick={resetForm}>{t('reset')}</Button>
        </>
      }
    >
      <div className="nx-grid nx-gap-14 nx-mb-16" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
        <Input type="date" label={t('transactionDate')} value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        <Input type="number" min="0" label={t('customerCount')} required value={customerCount} onChange={(e) => setCustomerCount(e.target.value)} placeholder="0" />
        <Input type="number" min="0" step="0.01" label={t('cashOnHand')} value={cashOnHand} onChange={(e) => setCashOnHand(e.target.value)} placeholder="0.00" />
      </div>

      <div className="nx-mb-16">
        <label className="nx-text-base nx-font-700 nx-mb-8" style={{ display: 'block' }}>{t('salesChannels')}</label>
        {salesChannelsLoading ? (
          <div className="nx-p-16 nx-text-center nx-text-muted nx-text-base" style={{ border: '2px dashed var(--noorix-border)', borderRadius: 10 }}>
            {t('loading')}
          </div>
        ) : salesChannelsError ? (
          <div className="nx-p-16 nx-text-center nx-text-base nx-font-600" style={{ color: '#b91c1c', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10 }}>
            {salesChannelsError}
          </div>
        ) : salesChannels.length === 0 ? (
          <div className="nx-p-16 nx-text-center nx-text-muted nx-text-base" style={{ border: '2px dashed var(--noorix-border)', borderRadius: 10 }}>
            {t('noSalesChannels')}
          </div>
        ) : (
          <div className="sales-channels-grid nx-grid nx-gap-8">
            {salesChannels.map((v) => {
              const amt = channelAmounts[v.id] || '';
              return (
                <div key={v.id} className="nx-flex-col nx-gap-4">
                  <label className="nx-text-sm nx-font-600 nx-text-muted">{vaultDisplayName(v, lang)}</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amt}
                    onChange={(e) => setChannelAmounts((p) => ({ ...p, [v.id]: e.target.value }))}
                    placeholder="0.00"
                    className="nx-w-full nx-rounded nx-text-md nx-bg-surface nx-text-primary"
                    style={{ boxSizing: 'border-box', padding: '8px 10px', fontFamily: 'var(--noorix-font-numbers)', textAlign: 'right', border: '1px solid var(--noorix-border)' }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="nx-mb-16">
        <Input multiline label={t('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('notesPlaceholder')} style={{ resize: 'vertical' }} />
      </div>

      <div className={`noorix-summary-bar noorix-summary-bar--${vatEnabled && totalAmount.gt(0) ? '5' : '3'} nx-mb-8`}>
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

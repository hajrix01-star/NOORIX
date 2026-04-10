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
import { Button, Input, AdaptiveSheet , FmtNum } from '../../../ui';

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
      <AdaptiveSheet
        open={true}
        onClose={() => { resetForm(); onClose?.(); }}
        title={t('summarySaved')}
        size="sm"
        side="start"
        className="sales-entry-success-drawer"
        footer={
          <>
            <Button onClick={() => { resetForm(); onClose?.(); }}>{t('addNewSummary')}</Button>
            <Button variant="ghost" onClick={() => { onClose?.(); resetForm(); }}>{t('close')}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* رقم الملخص */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-noorix-bg-muted">
            <span className="text-[12px] text-noorix-muted font-medium">{t('summaryNumber')}</span>
            <strong className="text-[14px]" style={{ color: 'var(--noorix-accent-blue)' }}>#{savedSummary.summaryNumber}</strong>
          </div>
          {/* أرقام الإجمالي والعملاء */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center py-4 rounded-xl" style={{ background: 'var(--noorix-green-12)' }}>
              <span className="text-[11px] text-noorix-muted mb-1">{t('total')}</span>
              <span dir="ltr" className="text-[20px] font-black nx-font-numbers" style={{ color: 'var(--noorix-accent-green)' }}><FmtNum n={savedSummary.totalAmount} /></span>
              <span className="nx-sar">SR</span>
            </div>
            <div className="flex flex-col items-center py-4 rounded-xl" style={{ background: 'var(--noorix-blue-8)' }}>
              <span className="text-[11px] text-noorix-muted mb-1">{t('customers')}</span>
              <span className="text-[20px] font-black" style={{ color: 'var(--noorix-accent-blue)' }}>{savedSummary.customerCount}</span>
              <span className="text-[11px] text-noorix-muted mt-0.5">&nbsp;</span>
            </div>
          </div>
          {/* إرسال واتساب */}
          <Button
            variant="success"
            size="md"
            className="w-full"
            onClick={() => {
              /* الـ API لا يعيد channels مع الملخص بعد الإنشاء — نبنيها من النموذج حتى تظهر في واتساب */
              const fromForm = salesChannels
                .filter((v) => parseFloat(channelAmounts[v.id]) > 0)
                .map((v) => ({ vaultId: v.id, amount: channelAmounts[v.id], vault: v }));
              onWhatsApp?.({
                ...savedSummary,
                channels: fromForm.length ? fromForm : (savedSummary.channels || []),
              });
            }}
          >
            {t('sendWhatsApp')} — {t('salesDailySummary')}
          </Button>
        </div>
      </AdaptiveSheet>
    );
  }

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={t('dailySummaryInput')}
      size="md"
      side="start"
      className="sales-entry-drawer"
      footer={
        <>
          <Button
            variant="primary"
            disabled={createSummary.isPending || salesChannelsLoading || !!salesChannelsError || totalAmount.lte(0) || salesChannels.length === 0 || !customerCount || parseInt(customerCount, 10) <= 0}
            onClick={handleSave}
            className="flex-1 min-w-0"
          >
            {createSummary.isPending ? t('saving') : t('saveSummary')}
          </Button>
          <Button onClick={resetForm}>{t('reset')}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
        <Input type="date" label={t('transactionDate')} value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        <Input type="number" min="0" label={t('customerCount')} required value={customerCount} onChange={(e) => setCustomerCount(e.target.value)} placeholder="0" />
        <Input type="number" min="0" step="0.01" label={t('cashOnHand')} value={cashOnHand} onChange={(e) => setCashOnHand(e.target.value)} placeholder="0.00" />
      </div>

      <div className="mb-4">
        <label className="text-[13px] font-bold mb-2 block">{t('salesChannels')}</label>
        {salesChannelsLoading ? (
          <div className="p-4 text-center text-noorix-muted text-[13px] rounded-[10px]" style={{ border: '2px dashed var(--noorix-border)' }}>
            {t('loading')}
          </div>
        ) : salesChannelsError ? (
          <div className="p-4 text-center text-[13px] font-semibold rounded-[10px]" style={{ color: 'var(--noorix-accent-red)', background: 'var(--noorix-red-6)', border: '1px solid var(--noorix-red-20)' }}>
            {salesChannelsError}
          </div>
        ) : salesChannels.length === 0 ? (
          <div className="p-4 text-center text-noorix-muted text-[13px] rounded-[10px]" style={{ border: '2px dashed var(--noorix-border)' }}>
            {t('noSalesChannels')}
          </div>
        ) : (
          <div className="sales-channels-grid grid gap-2">
            {salesChannels.map((v) => {
              const amt = channelAmounts[v.id] || '';
              return (
                <div key={v.id} className="flex flex-col gap-1">
                  <label className="text-[12px] font-semibold text-noorix-muted nx-truncate" title={vaultDisplayName(v, lang)}>{vaultDisplayName(v, lang)}</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amt}
                    onChange={(e) => setChannelAmounts((p) => ({ ...p, [v.id]: e.target.value }))}
                    placeholder="0.00"
                    style={{ fontFamily: 'var(--noorix-font-numbers)' }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-4">
        <Input multiline label={t('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('notesPlaceholder')} style={{ resize: 'vertical' }} />
      </div>

      <div className={`noorix-summary-bar noorix-summary-bar--${vatEnabled && totalAmount.gt(0) ? '5' : '3'} mb-2`}>
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">{t('totalLabel')}</div>
          <div className="noorix-summary-bar__value noorix-summary-bar__value--green"><FmtNum n={totalAmount} /> <span className="nx-sar">SR</span></div>
        </div>
        {vatEnabled && totalAmount.gt(0) && (
          <>
            <div className="noorix-summary-bar__item">
              <div className="noorix-summary-bar__label">الصافي</div>
              <div className="noorix-summary-bar__value noorix-summary-bar__value--blue"><FmtNum n={totalNet} /> <span className="nx-sar">SR</span></div>
            </div>
            <div className="noorix-summary-bar__item">
              <div className="noorix-summary-bar__label">الضريبة</div>
              <div className="noorix-summary-bar__value noorix-summary-bar__value--amber"><FmtNum n={totalTax} /> <span className="nx-sar">SR</span></div>
            </div>
          </>
        )}
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">{t('customersLabel')}</div>
          <div className="noorix-summary-bar__value noorix-summary-bar__value--blue">{customerCount || 0}</div>
        </div>
        <div className="noorix-summary-bar__item">
          <div className="noorix-summary-bar__label">{t('avgPerOrder')}</div>
          <div className="noorix-summary-bar__value"><FmtNum n={avgPerCustomer} /> <span className="nx-sar">SR</span></div>
        </div>
      </div>
    </AdaptiveSheet>
  );
}

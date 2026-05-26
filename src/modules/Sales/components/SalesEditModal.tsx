/**
 * SalesEditModal — نافذة تعديل ملخص المبيعات
 * تفتح الصفحة/النموذج ويتم التعديل عليها
 */
import React, { useState, useEffect, useMemo } from 'react';
import Decimal from 'decimal.js';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { useTranslation } from '../../../i18n/useTranslation';
import { splitTaxFromTotal } from '../../../utils/math-engine';
import { Button, Input, AdaptiveSheet , FmtNum } from '../../../ui';
import { toDateInputYmd } from '../../../utils/saudiDate';

const CHANNEL_COLORS = {
  cash: { bg: 'var(--noorix-green-8)', border: 'var(--noorix-accent-green)', icon: '💵' },
  bank: { bg: 'var(--noorix-blue-8)', border: 'var(--noorix-accent-blue)', icon: '🏦' },
  app:  { bg: 'var(--noorix-violet-8)', border: 'var(--noorix-accent-violet)', icon: '📱' },
};

export function SalesEditModal({ summary, salesChannels, salesChannelsLoading = false, salesChannelsError = '', companyId, vatEnabled = false, vatRate = 0.15, shiftsEnabled = false, onSaved, onClose }: any) {
  const { lang, t } = useTranslation();
  const [txDate, setTxDate] = useState('');
  const [customerCount, setCustomerCount] = useState('');
  const [cashOnHand, setCashOnHand] = useState('');
  const [shift, setShift] = useState<'morning' | 'evening' | 'all'>('all');
  const [notes, setNotes] = useState('');
  const [channelAmounts, setChannelAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!summary) return;
    const ch = (summary.channels || []).reduce((acc: any, c: any) => {
      acc[c.vaultId] = String(c.amount ?? 0);
      return acc;
    }, {});
    setTxDate(toDateInputYmd(summary.transactionDate));
    setCustomerCount(String(summary.customerCount ?? 0));
    setCashOnHand(String(summary.cashOnHand ?? 0));
    setShift(summary.shift === 'morning' || summary.shift === 'evening' ? summary.shift : 'all');
    setNotes(summary.notes || '');
    setChannelAmounts(ch);
  }, [summary]);

  const mergedSalesChannels = useMemo(() => {
    const live = Array.isArray(salesChannels) ? [...salesChannels] : [];
    live.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.nameAr || '').localeCompare(String(b.nameAr || ''), 'ar'));
    const legacy = (summary?.channels || [])
      .filter((c: any) => c?.vaultId && !live.some((v: any) => v.id === c.vaultId))
      .map((c: any) => ({
        id: c.vaultId,
        nameAr: c.vault?.nameAr || 'قناة سابقة',
        type: c.vault?.type || 'cash',
        sortOrder: c.vault?.sortOrder ?? 9999,
        isLegacyDisabled: true,
      }));
    return [...live, ...legacy];
  }, [salesChannels, summary]);

  const totalAmount = Object.values(channelAmounts).reduce(
    (s: any, v: any) => s.plus(new Decimal(v || 0)),
    new Decimal(0),
  );
  const { net: totalNet, tax: totalTax } = useMemo(
    () => splitTaxFromTotal(totalAmount, vatEnabled, vatRate),
    [totalAmount, vatEnabled, vatRate],
  );
  const avgPerCustomer = (parseInt(customerCount, 10) || 0) > 0 && totalAmount.gt(0)
    ? totalAmount.div(parseInt(customerCount, 10))
    : new Decimal(0);

  async function handleSave() {
    setError('');
    const blockedLegacyChannels = mergedSalesChannels.filter((v: any) => v.isLegacyDisabled && parseFloat(channelAmounts[v.id]) > 0);
    if (blockedLegacyChannels.length > 0) {
      setError('بعض القنوات المستخدمة سابقاً لم تعد مفعلة كقنوات بيع. أعد تفعيلها من الخزائن أو وزّع المبلغ على القنوات الحالية.');
      return;
    }
    const channels = mergedSalesChannels
      .filter((v: any) => parseFloat(channelAmounts[v.id]) > 0)
      .map((v: any) => ({ vaultId: v.id, amount: channelAmounts[v.id] }));
    if (channels.length === 0) {
      setError('يجب إدخال قناة بيع واحدة على الأقل');
      return;
    }
    if (totalAmount.lte(0)) {
      setError('يجب أن يكون إجمالي المبيعات أكبر من صفر');
      return;
    }
    setSaving(true);
    try {
      await onSaved({
        transactionDate: txDate,
        customerCount: parseInt(customerCount, 10) || 0,
        cashOnHand: cashOnHand || '0',
        shift: shiftsEnabled ? shift : (summary.shift || 'all'),
        channels,
        notes: notes.trim() || undefined,
      });
      onClose?.();
    } catch (e: any) {
      setError(e?.message || 'فشل التحديث');
    } finally {
      setSaving(false);
    }
  }

  if (!summary) return null;

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={`تعديل ملخص المبيعات — ${summary.summaryNumber}`}
      size="xl"
      side="start"
      className="sales-edit-drawer"
      footer={
        <>
          <Button
            variant="primary"
            disabled={saving || salesChannelsLoading || !!salesChannelsError || totalAmount.lte(0) || mergedSalesChannels.length === 0}
            onClick={handleSave}
            className="flex-1 min-w-0"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </>
      }
    >
      {error && (
        <div className="rounded-lg text-[13px] mb-4 p-2.5 text-noorix-red" style={{ background: 'var(--noorix-red-10)', border: '1px solid var(--noorix-accent-red)' }}>
          {error}
        </div>
      )}

      <div className="grid gap-3.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Input type="date" label="تاريخ العملية *" value={txDate} onChange={(e: any) => setTxDate(e.target.value)} />
        <Input type="number" min="0" label="عدد العملاء" value={customerCount} onChange={(e: any) => setCustomerCount(e.target.value)} placeholder="0" />
        <Input type="number" min="0" step="0.01" label="المبلغ الموجود بالصندوق" value={cashOnHand} onChange={(e: any) => setCashOnHand(e.target.value)} placeholder="0.00" />
      </div>

      {shiftsEnabled && (
        <div className="mb-4">
          <label className="text-[13px] font-bold mb-2 block">{t('salesShiftLabel')}</label>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={shift === 'morning' ? 'primary' : 'ghost'} onClick={() => setShift('morning')}>
              {t('salesShiftMorning')}
            </Button>
            <Button size="sm" variant={shift === 'evening' ? 'primary' : 'ghost'} onClick={() => setShift('evening')}>
              {t('salesShiftEvening')}
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="text-[13px] font-bold mb-2 block">قنوات البيع</label>
        {salesChannelsLoading ? (
          <div className="p-4 text-center text-noorix-muted text-[13px] rounded-[10px]" style={{ border: '2px dashed var(--noorix-border)' }}>
            جاري تحميل قنوات البيع...
          </div>
        ) : salesChannelsError ? (
          <div className="p-4 text-center text-[13px] font-semibold rounded-[10px]" style={{ color: 'var(--noorix-accent-red)', background: 'var(--noorix-red-6)', border: '1px solid var(--noorix-red-20)' }}>
            {salesChannelsError}
          </div>
          ) : mergedSalesChannels.length === 0 ? (
          <div className="p-4 text-center text-noorix-muted text-[13px] rounded-[10px]" style={{ border: '2px dashed var(--noorix-border)' }}>
            لا توجد قنوات بيع مفعّلة.
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {mergedSalesChannels.map((v: any) => {
              const c = (CHANNEL_COLORS as Record<string, (typeof CHANNEL_COLORS)['cash']>)[String(v.type)] || CHANNEL_COLORS.cash;
              const amt = channelAmounts[v.id] ?? '';
              return (
                <div key={v.id} className="py-[10px] px-3 rounded-[10px]" style={{ background: c.bg, border: `1px solid ${c.border}44` }}>
                  <div className="flex items-center gap-6 mb-1.5">
                    <span className="text-[16px]">{c.icon}</span>
                    <div className="flex-1 min-w-0" style={{ minWidth: 0 }}>
                      <div className="font-bold text-[12px]">{vaultDisplayName(v, lang)}</div>
                      {v.isLegacyDisabled && (
                        <div className="font-bold mt-[2px] text-[10px]" style={{ color: 'var(--noorix-accent-amber)' }}>
                          قناة قديمة غير مفعلة حالياً
                        </div>
                      )}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amt}
                    onChange={(e: any) => setChannelAmounts((p: any) => ({ ...p, [v.id]: e.target.value }))}
                    placeholder="0.00"
                    className="w-full py-1.5 px-2 rounded-[7px] text-[15px] font-extrabold text-right"
                    style={{ fontFamily: 'var(--noorix-font-numbers)', border: `1px solid ${c.border}55`, background: v.isLegacyDisabled ? 'var(--noorix-bg-muted)' : 'var(--noorix-bg-surface)', color: 'var(--noorix-text)' }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-4">
        <Input multiline label="ملاحظات" value={notes} onChange={(e: any) => setNotes(e.target.value)} rows={2} placeholder="أي ملاحظات..." style={{ resize: 'vertical' }} />
      </div>

      <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
        <div className="rounded-xl text-center py-3 px-[14px]" style={{ background: 'var(--noorix-green-10)', border: '1px solid var(--noorix-green-30)' }}>
          <div className="text-[11px] text-noorix-green">الإجمالي</div>
          <div dir="ltr" className="text-[18px] font-black" style={{ color: 'var(--noorix-accent-green)', fontFamily: 'var(--noorix-font-numbers)' }}><FmtNum n={totalAmount.toNumber()} /> <span className="nx-sar">SR</span></div>
        </div>
        {vatEnabled && totalAmount.gt(0) && (
          <>
            <div className="rounded-xl text-center py-3 px-[14px]" style={{ background: 'var(--noorix-sky-10)', border: '1px solid var(--noorix-sky-30)' }}>
              <div className="text-[11px]" style={{ color: 'var(--noorix-accent-blue)' }}>الصافي</div>
              <div dir="ltr" className="text-[18px] font-black" style={{ color: 'var(--noorix-accent-sky)', fontFamily: 'var(--noorix-font-numbers)' }}><FmtNum n={totalNet.toNumber()} /> <span className="nx-sar">SR</span></div>
            </div>
            <div className="rounded-xl text-center py-3 px-[14px]" style={{ background: 'var(--noorix-yellow-10)', border: '1px solid var(--noorix-yellow-30)' }}>
              <div className="text-[11px]" style={{ color: 'var(--color-noorix-amber)' }}>الضريبة</div>
              <div dir="ltr" className="text-[18px] font-black" style={{ color: 'var(--color-noorix-amber)', fontFamily: 'var(--noorix-font-numbers)' }}><FmtNum n={totalTax.toNumber()} /> <span className="nx-sar">SR</span></div>
            </div>
          </>
        )}
        <div className="rounded-xl text-center py-3 px-[14px]" style={{ background: 'var(--noorix-blue-10)', border: '1px solid var(--noorix-blue-30)' }}>
          <div className="text-[11px]" style={{ color: 'var(--noorix-accent-blue)' }}>العملاء</div>
          <div className="text-[18px] font-black" style={{ color: 'var(--noorix-accent-blue)' }}>{customerCount || 0}</div>
        </div>
        <div className="rounded-xl text-center py-3 px-[14px]" style={{ background: 'var(--noorix-violet-10)', border: '1px solid var(--noorix-violet-30)' }}>
          <div className="text-[11px]" style={{ color: 'var(--noorix-accent-violet)' }}>معدل الطلب</div>
          <div dir="ltr" className="text-[18px] font-black" style={{ color: 'var(--noorix-accent-violet)', fontFamily: 'var(--noorix-font-numbers)' }}><FmtNum n={avgPerCustomer.toNumber()} /> <span className="nx-sar">SR</span></div>
        </div>
      </div>
    </AdaptiveSheet>
  );
}

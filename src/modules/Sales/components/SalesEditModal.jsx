/**
 * SalesEditModal — نافذة تعديل ملخص المبيعات
 * تفتح الصفحة/النموذج ويتم التعديل عليها
 */
import React, { useState, useEffect, useMemo } from 'react';
import Decimal from 'decimal.js';
import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { useTranslation } from '../../../i18n/useTranslation';
import { splitTaxFromTotal } from '../../../utils/math-engine';
import { Button, Input, Modal } from '../../../ui';

const CHANNEL_COLORS = {
  cash: { bg: 'rgba(22,163,74,0.08)', border: '#16a34a', icon: '💵' },
  bank: { bg: 'rgba(37,99,235,0.08)', border: '#2563eb', icon: '🏦' },
  app:  { bg: 'rgba(124,58,237,0.08)', border: '#7c3aed', icon: '📱' },
};

export function SalesEditModal({ summary, salesChannels, salesChannelsLoading = false, salesChannelsError = '', companyId, vatEnabled = false, vatRate = 0.15, onSaved, onClose }) {
  const { lang } = useTranslation();
  const [txDate, setTxDate] = useState('');
  const [customerCount, setCustomerCount] = useState('');
  const [cashOnHand, setCashOnHand] = useState('');
  const [notes, setNotes] = useState('');
  const [channelAmounts, setChannelAmounts] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!summary) return;
    const ch = (summary.channels || []).reduce((acc, c) => {
      acc[c.vaultId] = String(c.amount ?? 0);
      return acc;
    }, {});
    setTxDate(summary.transactionDate ? new Date(summary.transactionDate).toISOString().slice(0, 10) : '');
    setCustomerCount(String(summary.customerCount ?? 0));
    setCashOnHand(String(summary.cashOnHand ?? 0));
    setNotes(summary.notes || '');
    setChannelAmounts(ch);
  }, [summary]);

  const mergedSalesChannels = useMemo(() => {
    const live = Array.isArray(salesChannels) ? salesChannels : [];
    const legacy = (summary?.channels || [])
      .filter((c) => c?.vaultId && !live.some((v) => v.id === c.vaultId))
      .map((c) => ({
        id: c.vaultId,
        nameAr: c.vault?.nameAr || 'قناة سابقة',
        type: c.vault?.type || 'cash',
        isLegacyDisabled: true,
      }));
    return [...live, ...legacy];
  }, [salesChannels, summary]);

  const totalAmount = Object.values(channelAmounts).reduce(
    (s, v) => s.plus(new Decimal(v || 0)),
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
    const blockedLegacyChannels = mergedSalesChannels.filter((v) => v.isLegacyDisabled && parseFloat(channelAmounts[v.id]) > 0);
    if (blockedLegacyChannels.length > 0) {
      setError('بعض القنوات المستخدمة سابقاً لم تعد مفعلة كقنوات بيع. أعد تفعيلها من الخزائن أو وزّع المبلغ على القنوات الحالية.');
      return;
    }
    const channels = mergedSalesChannels
      .filter((v) => parseFloat(channelAmounts[v.id]) > 0)
      .map((v) => ({ vaultId: v.id, amount: channelAmounts[v.id] }));
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
        channels,
        notes: notes.trim() || undefined,
      });
      onClose?.();
    } catch (e) {
      setError(e?.message || 'فشل التحديث');
    } finally {
      setSaving(false);
    }
  }

  if (!summary) return null;

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`تعديل ملخص المبيعات — ${summary.summaryNumber}`}
      size="md"
      footer={
        <>
          <Button
            variant="success"
            disabled={saving || salesChannelsLoading || !!salesChannelsError || totalAmount.lte(0) || mergedSalesChannels.length === 0}
            onClick={handleSave}
            className="nx-flex-1"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </>
      }
    >
      {error && (
        <div className="nx-rounded nx-text-base nx-mb-16 nx-p-10" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #dc2626', color: '#dc2626' }}>
          {error}
        </div>
      )}

      <div className="nx-grid nx-gap-14" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 18 }}>
        <Input type="date" label="تاريخ العملية *" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
        <Input type="number" min="0" label="عدد العملاء" value={customerCount} onChange={(e) => setCustomerCount(e.target.value)} placeholder="0" />
        <Input type="number" min="0" step="0.01" label="المبلغ الموجود بالصندوق" value={cashOnHand} onChange={(e) => setCashOnHand(e.target.value)} placeholder="0.00" />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label className="nx-text-base nx-font-700 nx-mb-8" style={{ display: 'block' }}>قنوات البيع</label>
        {salesChannelsLoading ? (
          <div className="nx-p-16 nx-text-center nx-text-muted nx-text-base" style={{ border: '2px dashed var(--noorix-border)', borderRadius: 10 }}>
            جاري تحميل قنوات البيع...
          </div>
        ) : salesChannelsError ? (
          <div className="nx-p-16 nx-text-center nx-text-base nx-font-600" style={{ color: '#b91c1c', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10 }}>
            {salesChannelsError}
          </div>
          ) : mergedSalesChannels.length === 0 ? (
          <div className="nx-p-16 nx-text-center nx-text-muted nx-text-base" style={{ border: '2px dashed var(--noorix-border)', borderRadius: 10 }}>
            لا توجد قنوات بيع مفعّلة.
          </div>
        ) : (
          <div className="nx-grid nx-gap-8" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {mergedSalesChannels.map((v) => {
              const c = CHANNEL_COLORS[v.type] || CHANNEL_COLORS.cash;
              const amt = channelAmounts[v.id] ?? '';
              return (
                <div key={v.id} style={{ padding: '10px 12px', borderRadius: 10, background: c.bg, border: `1px solid ${c.border}44` }}>
                  <div className="nx-flex-center nx-gap-6 nx-mb-6">
                    <span className="nx-text-xl">{c.icon}</span>
                    <div className="nx-flex-1" style={{ minWidth: 0 }}>
                      <div className="nx-font-700 nx-text-sm">{vaultDisplayName(v, lang)}</div>
                      {v.isLegacyDisabled && (
                        <div className="nx-font-700" style={{ marginTop: 2, fontSize: 10, color: '#b45309' }}>
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
                    onChange={(e) => setChannelAmounts((p) => ({ ...p, [v.id]: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 7, fontSize: 15, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)', textAlign: 'right', border: `1px solid ${c.border}55`, background: v.isLegacyDisabled ? 'var(--noorix-bg-muted)' : 'var(--noorix-bg-surface)', color: 'var(--noorix-text)', boxSizing: 'border-box' }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <Input multiline label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="أي ملاحظات..." style={{ resize: 'vertical' }} />
      </div>

      <div className="nx-grid nx-gap-10" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', marginBottom: 18 }}>
        <div className="nx-rounded-lg nx-text-center" style={{ padding: '12px 14px', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)' }}>
          <div className="nx-text-xs" style={{ color: '#16a34a' }}>الإجمالي</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#16a34a', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(totalAmount)} ﷼</div>
        </div>
        {vatEnabled && totalAmount.gt(0) && (
          <>
            <div className="nx-rounded-lg nx-text-center" style={{ padding: '12px 14px', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)' }}>
              <div className="nx-text-xs" style={{ color: '#0ea5e9' }}>الصافي</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0ea5e9', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(totalNet)} ﷼</div>
            </div>
            <div className="nx-rounded-lg nx-text-center" style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div className="nx-text-xs" style={{ color: '#f59e0b' }}>الضريبة</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(totalTax)} ﷼</div>
            </div>
          </>
        )}
        <div className="nx-rounded-lg nx-text-center" style={{ padding: '12px 14px', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)' }}>
          <div className="nx-text-xs" style={{ color: '#2563eb' }}>العملاء</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#2563eb' }}>{customerCount || 0}</div>
        </div>
        <div className="nx-rounded-lg nx-text-center" style={{ padding: '12px 14px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
          <div className="nx-text-xs" style={{ color: '#7c3aed' }}>معدل الطلب</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#7c3aed', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(avgPerCustomer)} ﷼</div>
        </div>
      </div>
    </Modal>
  );
}

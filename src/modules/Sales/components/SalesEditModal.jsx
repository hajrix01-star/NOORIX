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

const CHANNEL_COLORS = {
  cash: { bg: 'rgba(22,163,74,0.08)', border: '#16a34a', icon: '💵' },
  bank: { bg: 'rgba(37,99,235,0.08)', border: '#2563eb', icon: '🏦' },
  app:  { bg: 'rgba(124,58,237,0.08)', border: '#7c3aed', icon: '📱' },
};

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
};

export function SalesEditModal({ summary, salesChannels, companyId, vatEnabled = false, vatRate = 0.15, onSaved, onClose }) {
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
    const channels = salesChannels
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
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="noorix-surface-card"
        style={{
          maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto',
          padding: 24, borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>تعديل ملخص المبيعات — {summary.summaryNumber}</h3>
          <button type="button" className="noorix-btn-nav" onClick={onClose} style={{ padding: '6px 12px' }}>✕ إغلاق</button>
        </div>

        {error && (
          <div style={{ padding: 10, marginBottom: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid #dc2626', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>تاريخ العملية *</label>
            <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>عدد العملاء</label>
            <input type="number" min="0" value={customerCount} onChange={(e) => setCustomerCount(e.target.value)} placeholder="0" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>المبلغ الموجود بالصندوق</label>
            <input type="number" min="0" step="0.01" value={cashOnHand} onChange={(e) => setCashOnHand(e.target.value)} placeholder="0.00" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🛒 قنوات البيع</label>
          {salesChannels.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--noorix-text-muted)', border: '2px dashed var(--noorix-border)', borderRadius: 10, fontSize: 13 }}>
              لا توجد قنوات بيع مفعّلة.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {salesChannels.map((v) => {
                const c = CHANNEL_COLORS[v.type] || CHANNEL_COLORS.cash;
                const amt = channelAmounts[v.id] ?? '';
                return (
                  <div key={v.id} style={{ padding: '10px 12px', borderRadius: 10, background: c.bg, border: `1px solid ${c.border}44` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{c.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{vaultDisplayName(v, lang)}</div>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amt}
                      onChange={(e) => setChannelAmounts((p) => ({ ...p, [v.id]: e.target.value }))}
                      placeholder="0.00"
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 7, fontSize: 15, fontWeight: 800, fontFamily: 'var(--noorix-font-numbers)', textAlign: 'right', border: `1px solid ${c.border}55`, background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)', boxSizing: 'border-box' }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>ملاحظات</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="أي ملاحظات..." style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#16a34a' }}>💰 الإجمالي</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#16a34a', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(totalAmount)} ﷼</div>
          </div>
          {vatEnabled && totalAmount.gt(0) && (
            <>
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#0ea5e9' }}>الصافي</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#0ea5e9', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(totalNet)} ﷼</div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#f59e0b' }}>الضريبة</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(totalTax)} ﷼</div>
              </div>
            </>
          )}
          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#2563eb' }}>👥 العملاء</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#2563eb' }}>{customerCount || 0}</div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#7c3aed' }}>📊 معدل الطلب</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#7c3aed', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(avgPerCustomer)} ﷼</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="noorix-btn-nav noorix-btn-success"
            disabled={saving || totalAmount.lte(0) || salesChannels.length === 0}
            onClick={handleSave}
            style={{ flex: 1 }}
          >
            {saving ? 'جاري الحفظ...' : '💾 حفظ التعديلات'}
          </button>
          <button type="button" className="noorix-btn-nav" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

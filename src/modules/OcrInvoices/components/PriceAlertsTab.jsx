import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n/useTranslation';
import { bulkDeletePriceHistory } from '../services/ocrApi';

const fmtNum  = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

/* ── عارض صورة مدمج داخل النافذة ─────────────────────────────────── */
function MiniImageViewer({ src }) {
  const [rotation, setRotation] = useState(0);
  const [zoomed,   setZoomed]   = useState(false);
  if (!src) return (
    <div style={{
      height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: '#f9fafb', borderRadius: 10,
      border: '1px dashed #e5e7eb', color: '#9ca3af', fontSize: 13, gap: 6,
    }}>
      <span style={{ fontSize: 28 }}>🧾</span>
      <span>لا توجد صورة مرفقة</span>
    </div>
  );
  return (
    <div style={{ background: '#f9fafb', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <div style={{ maxHeight: zoomed ? 380 : 150, overflow: zoomed ? 'auto' : 'hidden', transition: 'max-height 0.3s' }}>
        <img
          src={src} alt="invoice"
          style={{ width: '100%', objectFit: 'contain', display: 'block', transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s', cursor: 'pointer' }}
          onClick={() => setZoomed((z) => !z)}
        />
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
        <button onClick={() => setRotation((r) => (r + 90) % 360)}
          style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', fontSize: 12 }}>
          🔄 تدوير
        </button>
        <button onClick={() => setZoomed((z) => !z)}
          style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', fontSize: 12 }}>
          {zoomed ? '🔽 تصغير' : '🔍 تكبير'}
        </button>
      </div>
    </div>
  );
}

/* ── شريط التقدم السعري ──────────────────────────────────────────── */
function PriceBar({ lowest, latest, average }) {
  const max = Math.max(lowest, latest, average) * 1.05;
  const pct = (v) => Math.min((v / max) * 100, 100);
  return (
    <div style={{ margin: '8px 0', userSelect: 'none' }}>
      {[
        { label: 'أفضل', value: lowest,  color: '#16a34a' },
        { label: 'متوسط', value: average, color: '#d97706' },
        { label: 'أخير',  value: latest,  color: '#dc2626' },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <div style={{ width: 32, fontSize: 11, color, fontWeight: 600, textAlign: 'end', flexShrink: 0 }}>{label}</div>
          <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct(value)}%`, background: color, borderRadius: 99, transition: 'width 0.6s' }} />
          </div>
          <div style={{ width: 64, fontSize: 12, fontWeight: 700, color, textAlign: 'start', flexShrink: 0 }}>
            {fmtNum(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── بطاقة إحصائية ────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color = '#374151' }) {
  return (
    <div style={{ flex: 1, minWidth: 100, padding: '12px 14px', borderRadius: 12, background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)' }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

/* ── نافذة المقارنة الاحترافية ────────────────────────────────────── */
function CompareModal({ alert, latestInvoice, lowestInvoice, onClose }) {
  const saving = (alert.latestPrice - alert.lowestPrice).toFixed(2);
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div dir="rtl" style={{
        background: 'var(--noorix-bg)', borderRadius: 18, maxWidth: 860, width: '100%',
        maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── رأس النافذة ── */}
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid var(--noorix-border)',
          position: 'sticky', top: 0, background: 'var(--noorix-bg)', zIndex: 2,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', marginBottom: 3, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              تنبيه سعري — مقارنة الفاتورتين
            </div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{alert.itemName}</div>
            {alert.category && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 600 }}>{alert.category}</span>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)',
            borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 18, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* ── شريط الملخص ── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, padding: '14px 22px',
          background: 'rgba(220,38,38,0.04)', borderBottom: '1px solid rgba(220,38,38,0.12)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginBottom: 4 }}>ارتفاع السعر</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>+{alert.priceIncreasePercent}%</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              التوفير المحتمل: <strong style={{ color: '#16a34a' }}>{fmtNum(saving)} ريال / وحدة</strong>
            </div>
          </div>
          <PriceBar lowest={alert.lowestPrice} latest={alert.latestPrice} average={alert.averagePrice} />
        </div>

        {/* ── المقارنة جانباً ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 14, padding: '18px 22px' }}>

          {/* السعر الحالي المرتفع */}
          <div style={{ borderRadius: 14, border: '2px solid rgba(220,38,38,0.35)', overflow: 'hidden' }}>
            <div style={{ background: 'rgba(220,38,38,0.07)', padding: '12px 16px', borderBottom: '1px solid rgba(220,38,38,0.2)' }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>📈</span> السعر الأخير (المرتفع)
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>
                {fmtNum(alert.latestPrice)} <span style={{ fontSize: 14, fontWeight: 400 }}>ريال</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                <div>🏭 {alert.latestSupplier}</div>
                <div>📅 {fmtDate(alert.latestInvoiceDate)}</div>
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--noorix-bg-surface)' }}>
              <MiniImageViewer src={latestInvoice?.imageUrl} />
              {latestInvoice?.lines?.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {latestInvoice.lines.slice(0, 2).map((l, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}>
                      <strong>{l.nameAr || l.item?.nameAr || l.nameEn || l.item?.nameEn}</strong>
                      <div style={{ color: '#6b7280', marginTop: 2 }}>
                        {fmtNum(l.unitPrice)} ريال × {l.quantity} = {fmtNum(l.totalPrice)} ريال
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* أفضل سعر */}
          <div style={{ borderRadius: 14, border: '2px solid rgba(22,163,74,0.35)', overflow: 'hidden' }}>
            <div style={{ background: 'rgba(22,163,74,0.07)', padding: '12px 16px', borderBottom: '1px solid rgba(22,163,74,0.2)' }}>
              <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>✅</span> أفضل سعر مسجّل
              </div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#16a34a', lineHeight: 1 }}>
                {fmtNum(alert.lowestPrice)} <span style={{ fontSize: 14, fontWeight: 400 }}>ريال</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                <div>🏭 {alert.lowestSupplier}</div>
                <div>📅 {fmtDate(alert.lowestInvoiceDate)}</div>
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--noorix-bg-surface)' }}>
              <MiniImageViewer src={lowestInvoice?.imageUrl} />
              {lowestInvoice?.lines?.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {lowestInvoice.lines.slice(0, 2).map((l, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.15)' }}>
                      <strong>{l.nameAr || l.item?.nameAr || l.nameEn || l.item?.nameEn}</strong>
                      <div style={{ color: '#6b7280', marginTop: 2 }}>
                        {fmtNum(l.unitPrice)} ريال × {l.quantity} = {fmtNum(l.totalPrice)} ريال
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── نصيحة التوفير ── */}
        <div style={{ margin: '0 22px 22px', padding: '14px 16px', borderRadius: 12, background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.25)' }}>
          <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>
            💡 يمكن توفير <strong>{fmtNum(saving)} ريال للوحدة</strong> عند الشراء من {alert.lowestSupplier}
          </div>
          <div style={{ fontSize: 13, color: '#15803d' }}>
            المتوسط التاريخي: {fmtNum(alert.averagePrice)} ريال — السعر الأخير أعلى بنسبة {alert.priceIncreasePercent}% عن أفضل سعر مسجّل.
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            ملاحظة: جميع الأسعار معروضة بدون ضريبة القيمة المضافة (خالص ضريبة).
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── الصفحة الرئيسية ─────────────────────────────────────────────── */
export default function PriceAlertsTab({ alerts = [], loading, invoices = [], onRefresh }) {
  const { language } = useTranslation();
  const [comparing, setComparing]   = useState(null);
  const [selected,  setSelected]    = useState(new Set());
  const [deleting,  setDeleting]    = useState(false);
  const [dismissed, setDismissed]   = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('noorix-dismissed-alerts') || '[]')); } catch { return new Set(); }
  });
  const [search, setSearch]   = useState('');
  const [sortBy, setSortBy]   = useState('pct'); // pct | savings | name
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const visibleAlerts = useMemo(() => {
    let list = alerts.filter((a) => !dismissed.has(a.itemId));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.itemName?.toLowerCase().includes(q) || a.latestSupplier?.toLowerCase().includes(q));
    }
    if (sortBy === 'pct')     list = [...list].sort((a, b) => b.priceIncreasePercent - a.priceIncreasePercent);
    if (sortBy === 'savings') list = [...list].sort((a, b) => (b.latestPrice - b.lowestPrice) - (a.latestPrice - a.lowestPrice));
    if (sortBy === 'name')    list = [...list].sort((a, b) => a.itemName.localeCompare(b.itemName, 'ar'));
    return list;
  }, [alerts, dismissed, search, sortBy]);

  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const selectAll = () => setSelected(new Set(visibleAlerts.map((a) => a.itemId)));
  const clearAll  = () => setSelected(new Set());

  const dismissSelected = () => {
    const next = new Set([...dismissed, ...selected]);
    setDismissed(next);
    setSelected(new Set());
    try { localStorage.setItem('noorix-dismissed-alerts', JSON.stringify([...next])); } catch {}
  };

  const handleBulkDeleteHistory = async () => {
    if (!selected.size || !window.confirm(`حذف سجل الأسعار لـ ${selected.size} صنف؟ سيؤدي هذا إلى إزالة التنبيهات نهائياً.`)) return;
    setDeleting(true);
    await bulkDeletePriceHistory([...selected]);
    setSelected(new Set());
    setDeleting(false);
    onRefresh?.();
  };

  const avgIncrease  = visibleAlerts.length ? Math.round(visibleAlerts.reduce((s, a) => s + a.priceIncreasePercent, 0) / visibleAlerts.length) : 0;
  const totalSavings = visibleAlerts.reduce((s, a) => s + (a.latestPrice - a.lowestPrice), 0);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--noorix-text-muted)' }}>⏳ جاري التحميل...</div>;
  }

  if (alerts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 70, color: 'var(--noorix-text-muted)' }} dir={dir}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--noorix-text)' }}>جميع الأسعار في النطاق الطبيعي</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>لا توجد فوارق سعرية تستوجب التنبيه حالياً.</div>
      </div>
    );
  }

  return (
    <div dir={dir} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── ملخص إحصائي ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatCard icon="⚠️" label="إجمالي التنبيهات"   value={`${visibleAlerts.length} تنبيه`}  color="#dc2626" />
        <StatCard icon="📈" label="متوسط الارتفاع"     value={`+${avgIncrease}%`}               color="#d97706" />
        <StatCard icon="💰" label="إجمالي فرص التوفير" value={`${fmtNum(totalSavings)} ريال`}   color="#16a34a" />
      </div>

      {/* ── شريط الأدوات ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالصنف أو المورد..."
          style={{
            flex: 1, minWidth: 180, padding: '9px 14px', borderRadius: 10, boxSizing: 'border-box',
            border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
            color: 'var(--noorix-text)', fontSize: 14,
          }}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            padding: '9px 12px', borderRadius: 10, border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)', fontSize: 13, cursor: 'pointer',
          }}
        >
          <option value="pct">ترتيب: أعلى نسبة</option>
          <option value="savings">ترتيب: أكبر توفير</option>
          <option value="name">ترتيب: الاسم</option>
        </select>

        {selected.size > 0 ? (
          <>
            <button onClick={clearAll} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--noorix-border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              إلغاء التحديد
            </button>
            <button onClick={dismissSelected}
              style={{ padding: '9px 14px', borderRadius: 10, background: '#f59e0b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
              👁️ إخفاء ({selected.size})
            </button>
            <button onClick={handleBulkDeleteHistory} disabled={deleting}
              style={{ padding: '9px 14px', borderRadius: 10, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
              {deleting ? '⏳' : '🗑️'} حذف السجل ({selected.size})
            </button>
          </>
        ) : (
          <button onClick={selectAll} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--noorix-border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            تحديد الكل
          </button>
        )}
      </div>

      {/* ── قائمة التنبيهات ── */}
      {visibleAlerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--noorix-text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <div>لا توجد نتائج مطابقة للبحث.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibleAlerts.map((alert, i) => {
            const latestInvoice = invoices.find((inv) => inv.id === alert.latestInvoiceId);
            const lowestInvoice = invoices.find((inv) => inv.id === alert.lowestInvoiceId);
            const isSelected = selected.has(alert.itemId);
            const saving = (alert.latestPrice - alert.lowestPrice).toFixed(2);

            return (
              <div
                key={`${alert.itemId}-${i}`}
                style={{
                  borderRadius: 14,
                  border: `1px solid ${isSelected ? '#3b82f6' : 'var(--noorix-border)'}`,
                  background: isSelected ? 'rgba(59,130,246,0.04)' : 'var(--noorix-bg-surface)',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* ── رأس البطاقة ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                  borderBottom: '1px solid var(--noorix-border)',
                  background: isSelected ? 'rgba(59,130,246,0.03)' : 'rgba(220,38,38,0.03)',
                  borderInlineStart: `4px solid ${isSelected ? '#3b82f6' : '#dc2626'}`,
                  flexWrap: 'wrap',
                }}>
                  <input
                    type="checkbox" checked={isSelected} onChange={() => toggleSelect(alert.itemId)}
                    style={{ width: 16, height: 16, flexShrink: 0, accentColor: '#3b82f6', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.itemName}</div>
                    {alert.category && (
                      <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 5, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 600 }}>{alert.category}</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', padding: '6px 14px', borderRadius: 10, background: 'rgba(220,38,38,0.1)', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>ارتفاع</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>+{alert.priceIncreasePercent}%</div>
                  </div>
                </div>

                {/* ── جسم البطاقة ── */}
                <div style={{ padding: '14px 18px' }}>

                  {/* شريط السعر المرئي */}
                  <PriceBar lowest={alert.lowestPrice} latest={alert.latestPrice} average={alert.averagePrice} />

                  {/* بطاقتا السعر */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 12 }}>
                    {/* السعر الأخير */}
                    <button
                      onClick={() => setComparing({ alert, latestInvoice, lowestInvoice })}
                      style={{
                        padding: '12px 14px', borderRadius: 12, textAlign: 'inherit', cursor: 'pointer', fontFamily: 'inherit',
                        background: 'rgba(220,38,38,0.06)', border: '1.5px solid rgba(220,38,38,0.3)',
                        transition: 'box-shadow 0.15s, transform 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(220,38,38,0.18)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                    >
                      <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>السعر الأخير 🔍</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626', lineHeight: 1, marginBottom: 4 }}>
                        {fmtNum(alert.latestPrice)} <span style={{ fontSize: 12, fontWeight: 400 }}>ريال</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>🏭 {alert.latestSupplier}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>📅 {fmtDate(alert.latestInvoiceDate)}</div>
                    </button>

                    {/* أفضل سعر */}
                    <button
                      onClick={() => setComparing({ alert, latestInvoice, lowestInvoice })}
                      style={{
                        padding: '12px 14px', borderRadius: 12, textAlign: 'inherit', cursor: 'pointer', fontFamily: 'inherit',
                        background: 'rgba(22,163,74,0.06)', border: '1.5px solid rgba(22,163,74,0.3)',
                        transition: 'box-shadow 0.15s, transform 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,163,74,0.18)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                    >
                      <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>أفضل سعر ✅</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', lineHeight: 1, marginBottom: 4 }}>
                        {fmtNum(alert.lowestPrice)} <span style={{ fontSize: 12, fontWeight: 400 }}>ريال</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>🏭 {alert.lowestSupplier}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>📅 {fmtDate(alert.lowestInvoiceDate)}</div>
                    </button>
                  </div>

                  {/* ── ذيل: توفير + إجراءات ── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 700 }}>
                      💡 توفير محتمل: {fmtNum(saving)} ريال / وحدة
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setComparing({ alert, latestInvoice, lowestInvoice })}
                        style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
                      >
                        📊 مقارنة الفاتورتين
                      </button>
                      <button
                        onClick={() => {
                          const next = new Set([...dismissed, alert.itemId]);
                          setDismissed(next);
                          try { localStorage.setItem('noorix-dismissed-alerts', JSON.stringify([...next])); } catch {}
                        }}
                        style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--noorix-border)', color: 'var(--noorix-text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
                      >
                        إخفاء
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dismissed.size > 0 && (
        <button
          onClick={() => {
            setDismissed(new Set());
            try { localStorage.removeItem('noorix-dismissed-alerts'); } catch {}
          }}
          style={{ alignSelf: 'center', padding: '8px 16px', borderRadius: 10, border: '1px solid var(--noorix-border)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--noorix-text-muted)', fontFamily: 'inherit' }}
        >
          🔄 إظهار {dismissed.size} تنبيه مخفي
        </button>
      )}

      {/* ── نافذة المقارنة ── */}
      {comparing && (
        <CompareModal
          alert={comparing.alert}
          latestInvoice={comparing.latestInvoice}
          lowestInvoice={comparing.lowestInvoice}
          onClose={() => setComparing(null)}
        />
      )}
    </div>
  );
}

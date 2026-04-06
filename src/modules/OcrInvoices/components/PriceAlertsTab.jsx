import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n/useTranslation';

const fmtNum  = (n) => Number(n).toLocaleString('en-US');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

/* ── عارض صورة مدمج داخل النافذة (بدون صفحة جديدة) ──────────────── */
function MiniImageViewer({ src }) {
  const [rotation, setRotation] = useState(0);
  const [zoomed,   setZoomed]   = useState(false);
  if (!src) return <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>لا توجد صورة</div>;
  return (
    <div style={{ background: '#f9fafb', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <div style={{ position: 'relative', maxHeight: zoomed ? 360 : 140, overflow: zoomed ? 'auto' : 'hidden', transition: 'max-height 0.3s' }}>
        <img
          src={src} alt="invoice"
          style={{ width: '100%', objectFit: 'contain', display: 'block', transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s', cursor: 'pointer' }}
          onClick={() => setZoomed((z) => !z)}
        />
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '6px 8px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
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

/* ── نافذة مقارنة الفاتورتين ──────────────────────────────────────── */
function CompareModal({ alert, latestInvoice, lowestInvoice, onClose }) {
  const dir = 'rtl';
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div dir={dir} style={{
        background: '#fff', borderRadius: 16, maxWidth: 820, width: '100%',
        maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        {/* رأس */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📊 مقارنة الأسعار</h3>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{alert.itemName}</div>
          </div>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* الزيادة */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 20px', background: 'rgba(220,38,38,0.05)', borderBottom: '1px solid #fecaca' }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: '#dc2626' }}>+{alert.priceIncreasePercent}%</span>
          <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>ارتفاع عن أفضل سعر مسجّل</span>
        </div>

        {/* المقارنة جانباً */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 0, padding: 20 }}>

          {/* فاتورة السعر الحالي */}
          <div style={{ padding: 16, borderRadius: 12, border: '2px solid #fca5a5', background: '#fff5f5', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, marginBottom: 4 }}>السعر الأخير (المرتفع)</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#dc2626' }}>{fmtNum(alert.latestPrice)} <span style={{ fontSize: 14 }}>ريال</span></div>
              </div>
              <div style={{ fontSize: 32 }}>📈</div>
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              <div>🏭 {alert.latestSupplier}</div>
              <div>📅 {fmtDate(alert.latestInvoiceDate)}</div>
            </div>
            {latestInvoice && (
              <MiniImageViewer src={latestInvoice.imageUrl} />
            )}
            {latestInvoice?.lines?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {latestInvoice.lines
                  .filter((l) => (l.nameAr || l.item?.nameAr || '').includes(alert.itemName.slice(0, 4)))
                  .slice(0, 2)
                  .map((l, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, background: '#fff', border: '1px solid #fca5a5', marginBottom: 4 }}>
                      <strong>{l.nameAr || l.item?.nameAr}</strong> — {fmtNum(l.unitPrice)} ريال × {l.quantity} = {fmtNum(l.totalPrice)} ريال
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* فاتورة أفضل سعر */}
          <div style={{ padding: 16, borderRadius: 12, border: '2px solid #86efac', background: '#f0fdf4', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, marginBottom: 4 }}>أفضل سعر مسجّل</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#16a34a' }}>{fmtNum(alert.lowestPrice)} <span style={{ fontSize: 14 }}>ريال</span></div>
              </div>
              <div style={{ fontSize: 32 }}>✅</div>
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              <div>🏭 {alert.lowestSupplier}</div>
              <div>📅 {fmtDate(alert.lowestInvoiceDate)}</div>
            </div>
            {lowestInvoice && (
              <MiniImageViewer src={lowestInvoice.imageUrl} />
            )}
            {lowestInvoice?.lines?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {lowestInvoice.lines
                  .filter((l) => (l.nameAr || l.item?.nameAr || '').includes(alert.itemName.slice(0, 4)))
                  .slice(0, 2)
                  .map((l, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, background: '#fff', border: '1px solid #86efac', marginBottom: 4 }}>
                      <strong>{l.nameAr || l.item?.nameAr}</strong> — {fmtNum(l.unitPrice)} ريال × {l.quantity} = {fmtNum(l.totalPrice)} ريال
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* ملخص التوفير */}
        <div style={{ margin: '0 20px 20px', padding: '12px 16px', borderRadius: 12, background: 'rgba(22,163,74,0.08)', border: '1px solid #86efac' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#16a34a', marginBottom: 4 }}>
            💡 يمكن توفير {fmtNum(alert.latestPrice - alert.lowestPrice)} ريال للوحدة عند الشراء من {alert.lowestSupplier}
          </div>
          <div style={{ fontSize: 13, color: '#15803d' }}>
            متوسط السعر التاريخي: {fmtNum(alert.averagePrice)} ريال
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── الصفحة الرئيسية ─────────────────────────────────────────────── */
export default function PriceAlertsTab({ alerts = [], loading, invoices = [] }) {
  const { t, language } = useTranslation();
  const [comparing, setComparing] = useState(null);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--noorix-text-muted)' }}>⏳ جاري التحميل...</div>;
  }

  if (alerts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--noorix-text-muted)' }} dir={dir}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{t('ocrNoPriceAlerts')}</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>جميع الأسعار في النطاق الطبيعي.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} dir={dir}>
      <div style={{ fontSize: 13, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>
        {alerts.length} تنبيه سعري — اضغط على أي بطاقة سعر لمقارنة الفاتورتين
      </div>

      {alerts.map((alert, i) => {
        const latestInvoice = invoices.find((inv) => inv.id === alert.latestInvoiceId);
        const lowestInvoice = invoices.find((inv) => inv.id === alert.lowestInvoiceId);

        return (
          <div key={`${alert.itemId}-${i}`} className="noorix-surface-card"
            style={{ padding: '16px 18px', borderInlineStart: '4px solid #dc2626' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 17 }}>⚠️</span>
                  <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alert.itemName}</div>
                  {alert.category && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', flexShrink: 0 }}>
                      {alert.category}
                    </span>
                  )}
                </div>

                {/* بطاقات السعر — قابلة للضغط */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  {/* السعر الأخير */}
                  <button
                    onClick={() => setComparing({ alert, latestInvoice, lowestInvoice })}
                    style={{
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'inherit',
                      background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
                      transition: 'transform 0.12s, box-shadow 0.12s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,38,38,0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                  >
                    <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 2 }}>{t('ocrLatestPrice')} 🔍</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{fmtNum(alert.latestPrice)} ريال</div>
                    <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 2 }}>{alert.latestSupplier}</div>
                  </button>

                  {/* أفضل سعر */}
                  <button
                    onClick={() => setComparing({ alert, latestInvoice, lowestInvoice })}
                    style={{
                      padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'inherit',
                      background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)',
                      transition: 'transform 0.12s, box-shadow 0.12s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(22,163,74,0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                  >
                    <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 2 }}>{t('ocrBestPrice')} 🔍</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{fmtNum(alert.lowestPrice)} ريال</div>
                    <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 2 }}>{alert.lowestSupplier}</div>
                  </button>

                  {/* المتوسط */}
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginBottom: 2 }}>متوسط السعر</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>{fmtNum(alert.averagePrice)} ريال</div>
                  </div>
                </div>
              </div>

              {/* نسبة الزيادة */}
              <div style={{ textAlign: 'center', padding: '10px 14px', borderRadius: 12, background: 'rgba(220,38,38,0.1)', minWidth: 72, flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{t('ocrPriceIncrease')}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#dc2626' }}>+{alert.priceIncreasePercent}%</div>
              </div>
            </div>

            {/* تلميح */}
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(22,163,74,0.06)', fontSize: 13 }}>
              💡 <strong>{t('ocrCheaperSupplier')}:</strong> {alert.lowestSupplier} — يقدمه بـ {fmtNum(alert.lowestPrice)} ريال
              {' '}(توفير {fmtNum(alert.latestPrice - alert.lowestPrice)} ريال للوحدة)
              <button
                onClick={() => setComparing({ alert, latestInvoice, lowestInvoice })}
                style={{ marginInlineStart: 10, fontSize: 12, padding: '3px 10px', borderRadius: 6, background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)', color: '#15803d', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                عرض المقارنة
              </button>
            </div>
          </div>
        );
      })}

      {/* نافذة المقارنة */}
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

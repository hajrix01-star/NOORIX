import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n/useTranslation';
import { bulkDeletePriceHistory } from '../services/ocrApi';

const fmtNum  = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

function MiniImageViewer({ src }) {
  const [rotation, setRotation] = useState(0);
  const [zoomed,   setZoomed]   = useState(false);
  if (!src) return (
    <div style={{
      height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--noorix-bg-muted)', borderRadius: 8, color: 'var(--noorix-text-muted)', fontSize: 13,
    }}>
      {'\u2014'}
    </div>
  );
  return (
    <div style={{ background: 'var(--noorix-bg-muted)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--noorix-border)' }}>
      <div style={{ maxHeight: zoomed ? 360 : 140, overflow: zoomed ? 'auto' : 'hidden', transition: 'max-height 0.3s' }}>
        <img src={src} alt="" style={{ width: '100%', objectFit: 'contain', display: 'block', transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s', cursor: 'pointer' }}
          onClick={() => setZoomed((z) => !z)} />
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '5px 8px', borderTop: '1px solid var(--noorix-border)' }}>
        <button onClick={() => setRotation((r) => (r + 90) % 360)}
          style={{ flex: 1, padding: '4px', borderRadius: 5, border: '1px solid var(--noorix-border)', background: 'transparent', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--noorix-text-muted)' }}>
          ↺
        </button>
        <button onClick={() => setZoomed((z) => !z)}
          style={{ flex: 1, padding: '4px', borderRadius: 5, border: '1px solid var(--noorix-border)', background: 'transparent', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: 'var(--noorix-text-muted)' }}>
          {zoomed ? '−' : '+'}
        </button>
      </div>
    </div>
  );
}

function CompareModal({ alert, latestInvoice, lowestInvoice, onClose, isAr }) {
  const saving = (alert.latestPrice - alert.lowestPrice).toFixed(2);
  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" dir={isAr ? 'rtl' : 'ltr'} style={{ maxWidth: 800 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{alert.itemName}</div>
            <div className="modal-sub">
              {isAr ? 'مقارنة الفاتورتين' : 'Invoice Comparison'} — +{alert.priceIncreasePercent}%
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="compare-modal-grid">
            {/* Latest (higher) */}
            <div className="compare-invoice-card">
              <div className="compare-invoice-label" style={{ color: '#b91c1c' }}>
                {isAr ? 'السعر الأخير' : 'Latest Price'}
              </div>
              {latestInvoice?.imageUrl && (
                <MiniImageViewer src={latestInvoice.imageUrl} />
              )}
              <div className="compare-invoice-meta" style={{ marginTop: 10 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#b91c1c' }}>
                  {fmtNum(alert.latestPrice)} <span style={{ fontSize: 12, fontWeight: 400 }}>{isAr ? 'ريال' : 'SAR'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{alert.latestSupplier}</div>
                <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{fmtDate(alert.latestInvoiceDate)}</div>
              </div>
            </div>

            {/* Best */}
            <div className="compare-invoice-card">
              <div className="compare-invoice-label" style={{ color: '#15803d' }}>
                {isAr ? 'أفضل سعر' : 'Best Price'}
              </div>
              {lowestInvoice?.imageUrl && (
                <MiniImageViewer src={lowestInvoice.imageUrl} />
              )}
              <div className="compare-invoice-meta" style={{ marginTop: 10 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#15803d' }}>
                  {fmtNum(alert.lowestPrice)} <span style={{ fontSize: 12, fontWeight: 400 }}>{isAr ? 'ريال' : 'SAR'}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{alert.lowestSupplier}</div>
                <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{fmtDate(alert.lowestInvoiceDate)}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(22,163,74,0.05)', border: '1px solid var(--noorix-border)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#15803d', marginBottom: 2 }}>
              {isAr ? 'التوفير المحتمل' : 'Potential Savings'}: {fmtNum(saving)} {isAr ? 'ريال / وحدة' : 'SAR/unit'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>
              {isAr ? `المتوسط التاريخي: ${fmtNum(alert.averagePrice)} ريال` : `Historical avg: ${fmtNum(alert.averagePrice)} SAR`}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function PriceAlertsTab({ alerts = [], loading, invoices = [], onRefresh }) {
  const { language } = useTranslation();
  const isAr = language === 'ar';
  const [comparing, setComparing]   = useState(null);
  const [selected,  setSelected]    = useState(new Set());
  const [deleting,  setDeleting]    = useState(false);
  const [dismissed, setDismissed]   = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('noorix-dismissed-alerts') || '[]')); } catch { return new Set(); }
  });
  const [search, setSearch]   = useState('');
  const [sortBy, setSortBy]   = useState('pct');
  const dir = isAr ? 'rtl' : 'ltr';

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

  const dismissSelected = () => {
    const next = new Set([...dismissed, ...selected]);
    setDismissed(next);
    setSelected(new Set());
    try { localStorage.setItem('noorix-dismissed-alerts', JSON.stringify([...next])); } catch {}
  };

  const handleBulkDeleteHistory = async () => {
    const msg = isAr ? `حذف سجل الأسعار لـ ${selected.size} صنف؟` : `Delete price history for ${selected.size} items?`;
    if (!selected.size || !window.confirm(msg)) return;
    setDeleting(true);
    await bulkDeletePriceHistory([...selected]);
    setSelected(new Set());
    setDeleting(false);
    onRefresh?.();
  };

  const avgIncrease  = visibleAlerts.length ? Math.round(visibleAlerts.reduce((s, a) => s + a.priceIncreasePercent, 0) / visibleAlerts.length) : 0;
  const totalSavings = visibleAlerts.reduce((s, a) => s + (a.latestPrice - a.lowestPrice), 0);
  const allChecked   = visibleAlerts.length > 0 && visibleAlerts.every((a) => selected.has(a.itemId));

  if (loading) return (
    <div className="ocr-loading">
      <div className="ocr-spinner" />
      <span>{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
    </div>
  );

  if (alerts.length === 0) return (
    <div className="ocr-empty" dir={dir}>
      <div className="ocr-empty-icon">✓</div>
      <div className="ocr-empty-text">{isAr ? 'جميع الأسعار في النطاق الطبيعي' : 'All prices within normal range'}</div>
      <div className="ocr-empty-sub">{isAr ? 'لا توجد فوارق سعرية تستوجب التنبيه حالياً' : 'No price anomalies detected'}</div>
    </div>
  );

  return (
    <div dir={dir} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Stats */}
      <div className="ocr-alerts-stats">
        <div className="ocr-alert-stat">
          <div className="ocr-alert-stat-value">{visibleAlerts.length}</div>
          <div className="ocr-alert-stat-label">{isAr ? 'تنبيه' : 'Alerts'}</div>
        </div>
        <div className="ocr-alert-stat">
          <div className="ocr-alert-stat-value" style={{ color: '#b45309' }}>+{avgIncrease}%</div>
          <div className="ocr-alert-stat-label">{isAr ? 'متوسط الارتفاع' : 'Avg. Increase'}</div>
        </div>
        <div className="ocr-alert-stat">
          <div className="ocr-alert-stat-value" style={{ color: '#15803d' }}>{fmtNum(totalSavings)}</div>
          <div className="ocr-alert-stat-label">{isAr ? 'فرص التوفير (ريال)' : 'Savings (SAR)'}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="inv-toolbar">
        <label className="inv-select-all-wrap">
          <input type="checkbox" checked={allChecked}
            onChange={allChecked ? () => setSelected(new Set()) : () => setSelected(new Set(visibleAlerts.map(a => a.itemId)))}
            className="inv-toolbar-checkbox" />
          <span className="inv-select-all-label">
            {selected.size > 0 ? (isAr ? `${selected.size} محدد` : `${selected.size} selected`) : (isAr ? 'تحديد الكل' : 'Select all')}
          </span>
        </label>

        <div className="inv-search-wrap">
          <span className="inv-search-icon">⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالصنف أو المورد...' : 'Search item or supplier...'}
            className="inv-search-input" />
          {search && <button className="inv-search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="inv-sort-select">
          <option value="pct">{isAr ? 'أعلى نسبة' : 'Highest %'}</option>
          <option value="savings">{isAr ? 'أكبر توفير' : 'Highest savings'}</option>
          <option value="name">{isAr ? 'الاسم' : 'Name'}</option>
        </select>

        {selected.size > 0 && (
          <>
            <button className="noorix-btn" style={{ fontSize: 13 }} onClick={dismissSelected}>
              {isAr ? `إخفاء (${selected.size})` : `Dismiss (${selected.size})`}
            </button>
            <button className="inv-delete-btn" onClick={handleBulkDeleteHistory} disabled={deleting}>
              {isAr ? `حذف السجل (${selected.size})` : `Delete (${selected.size})`}
            </button>
          </>
        )}
      </div>

      {/* Alert list */}
      {visibleAlerts.length === 0 ? (
        <div className="ocr-empty">
          <div className="ocr-empty-icon">⌕</div>
          <div className="ocr-empty-text">{isAr ? 'لا توجد نتائج' : 'No results'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visibleAlerts.map((alert, i) => {
            const latestInvoice = invoices.find((inv) => inv.id === alert.latestInvoiceId);
            const lowestInvoice = invoices.find((inv) => inv.id === alert.lowestInvoiceId);
            const isSelected = selected.has(alert.itemId);
            const saving = (alert.latestPrice - alert.lowestPrice).toFixed(2);

            return (
              <div key={`${alert.itemId}-${i}`} className="ocr-alert-card"
                onClick={() => setComparing({ alert, latestInvoice, lowestInvoice })}
                style={isSelected ? { borderColor: 'var(--noorix-text)', background: 'var(--noorix-bg-muted)' } : {}}>

                <input type="checkbox" checked={isSelected}
                  onChange={() => toggleSelect(alert.itemId)}
                  onClick={(e) => e.stopPropagation()}
                  className="ocr-catalog-checkbox" />

                <div className="ocr-alert-icon">↑</div>

                <div className="ocr-alert-content">
                  <div className="ocr-alert-title">{alert.itemName}</div>
                  <div className="ocr-alert-detail">
                    {alert.latestSupplier} · {fmtDate(alert.latestInvoiceDate)}
                    {saving > 0 && <span style={{ color: '#15803d', fontWeight: 600, marginInlineStart: 8 }}>
                      {isAr ? `توفير ${fmtNum(saving)}` : `Save ${fmtNum(saving)}`}
                    </span>}
                  </div>
                </div>

                <div className="ocr-alert-prices">
                  <div className="ocr-alert-price">
                    <div className="ocr-alert-price-value" style={{ color: '#15803d' }}>{fmtNum(alert.lowestPrice)}</div>
                    <div className="ocr-alert-price-label">{isAr ? 'أفضل' : 'Best'}</div>
                  </div>
                  <span className="ocr-alert-arrow">→</span>
                  <div className="ocr-alert-price">
                    <div className="ocr-alert-price-value" style={{ color: '#b91c1c' }}>{fmtNum(alert.latestPrice)}</div>
                    <div className="ocr-alert-price-label">{isAr ? 'أخير' : 'Latest'}</div>
                  </div>
                </div>

                <span className="ocr-alert-pct">+{alert.priceIncreasePercent}%</span>
              </div>
            );
          })}
        </div>
      )}

      {dismissed.size > 0 && (
        <button onClick={() => { setDismissed(new Set()); try { localStorage.removeItem('noorix-dismissed-alerts'); } catch {} }}
          className="noorix-btn" style={{ alignSelf: 'center', fontSize: 13 }}>
          {isAr ? `إظهار ${dismissed.size} تنبيه مخفي` : `Show ${dismissed.size} dismissed`}
        </button>
      )}

      {comparing && (
        <CompareModal
          alert={comparing.alert}
          latestInvoice={comparing.latestInvoice}
          lowestInvoice={comparing.lowestInvoice}
          onClose={() => setComparing(null)}
          isAr={isAr}
        />
      )}
    </div>
  );
}

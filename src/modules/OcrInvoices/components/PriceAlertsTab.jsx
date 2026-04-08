import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import { bulkDeletePriceHistory } from '../services/ocrApi';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { OCR_DISMISSED_ALERTS_KEY } from '../../../constants/storageKeys';
import { readJsonStorage, writeJsonStorage } from '../../../utils/jsonStorage';

const fmtNum  = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? formatSaudiDate(d) : '—');

function MiniImageViewer({ src }) {
  const [rotation, setRotation] = useState(0);
  const [zoomed,   setZoomed]   = useState(false);
  if (!src) return (
    <div className="flex items-center bg-noorix-bg-muted rounded-lg text-noorix-muted text-[13px] h-[100px] justify-center">
      {'\u2014'}
    </div>
  );
  return (
    <div className="bg-noorix-bg-muted rounded-lg overflow-hidden border border-noorix-border">
      <div style={{ maxHeight: zoomed ? 360 : 140, overflow: zoomed ? 'auto' : 'hidden', transition: 'max-height 0.3s' }}>
        <img src={src} alt="" className="w-full cursor-pointer" style={{ objectFit: 'contain', display: 'block', transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s' }}
          onClick={() => setZoomed((z) => !z)} />
      </div>
      <div className="flex gap-1 py-[5px] px-2 border-t border-noorix-border">
        <Button className="lb-btn" onClick={() => setRotation((r) => (r + 90) % 360)}>↺</Button>
        <Button className="lb-btn" onClick={() => setZoomed((z) => !z)}>{zoomed ? '−' : '+'}</Button>
      </div>
    </div>
  );
}

function CompareModal({ alert, latestInvoice, lowestInvoice, onClose, isAr }) {
  const saving = (alert.latestPrice - alert.lowestPrice).toFixed(2);
  return (
    <AdaptiveSheet open={true} onClose={onClose} size="xl" side="start" title={alert.itemName} className="price-compare-drawer">
      <div dir={isAr ? 'rtl' : 'ltr'}>
        <p className="text-[12px] text-noorix-muted mt-0 mb-3">
          {isAr ? 'مقارنة الفاتورتين' : 'Invoice Comparison'} — +{alert.priceIncreasePercent}%
        </p>

        <div className="modal-body">
          <div className="compare-modal-grid">
            {/* Latest (higher) */}
            <div className="compare-invoice-card">
              <div className="compare-invoice-label text-noorix-red">
                {isAr ? 'السعر الأخير' : 'Latest Price'}
              </div>
              {latestInvoice?.imageUrl && (
                <MiniImageViewer src={latestInvoice.imageUrl} />
              )}
              <div className="compare-invoice-meta mt-2.5">
                <div className="font-extrabold text-[22px] text-noorix-red">
                  {fmtNum(alert.latestPrice)} <span className="text-[12px] font-normal">{isAr ? 'ريال' : 'SAR'}</span>
                </div>
                <div className="text-[12px] text-noorix-muted">{alert.latestSupplier}</div>
                <div className="text-[12px] text-noorix-muted">{fmtDate(alert.latestInvoiceDate)}</div>
              </div>
            </div>

            {/* Best */}
            <div className="compare-invoice-card">
              <div className="compare-invoice-label text-noorix-green">
                {isAr ? 'أفضل سعر' : 'Best Price'}
              </div>
              {lowestInvoice?.imageUrl && (
                <MiniImageViewer src={lowestInvoice.imageUrl} />
              )}
              <div className="compare-invoice-meta mt-2.5">
                <div className="font-extrabold text-[22px] text-noorix-green">
                  {fmtNum(alert.lowestPrice)} <span className="text-[12px] font-normal">{isAr ? 'ريال' : 'SAR'}</span>
                </div>
                <div className="text-[12px] text-noorix-muted">{alert.lowestSupplier}</div>
                <div className="text-[12px] text-noorix-muted">{fmtDate(alert.lowestInvoiceDate)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg py-3 px-[14px] bg-noorix-green/5 border border-noorix-border">
            <div className="font-semibold text-[13px] text-noorix-green mb-[2px]">
              {isAr ? 'التوفير المحتمل' : 'Potential Savings'}: {fmtNum(saving)} {isAr ? 'ريال / وحدة' : 'SAR/unit'}
            </div>
            <div className="text-[12px] text-noorix-muted">
              {isAr ? `المتوسط التاريخي: ${fmtNum(alert.averagePrice)} ريال` : `Historical avg: ${fmtNum(alert.averagePrice)} SAR`}
            </div>
          </div>
        </div>
      </div>
    </AdaptiveSheet>
  );
}

export default function PriceAlertsTab({ alerts = [], loading, invoices = [], onRefresh }) {
  const { language } = useTranslation();
  const isAr = language === 'ar';
  const [comparing, setComparing]   = useState(null);
  const [selected,  setSelected]    = useState(new Set());
  const [deleting,  setDeleting]    = useState(false);
  const [dismissed, setDismissed]   = useState(() => new Set(readJsonStorage(OCR_DISMISSED_ALERTS_KEY, [])));
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
    writeJsonStorage(OCR_DISMISSED_ALERTS_KEY, [...next]);
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
    <div dir={dir} className="flex flex-col gap-[18px]">

      {/* Stats */}
      <div className="ocr-alerts-stats">
        <div className="ocr-alert-stat">
          <div className="ocr-alert-stat-value">{visibleAlerts.length}</div>
          <div className="ocr-alert-stat-label">{isAr ? 'تنبيه' : 'Alerts'}</div>
        </div>
        <div className="ocr-alert-stat">
          <div className="ocr-alert-stat-value" style={{ color: 'var(--noorix-accent-amber)' }}>+{avgIncrease}%</div>
          <div className="ocr-alert-stat-label">{isAr ? 'متوسط الارتفاع' : 'Avg. Increase'}</div>
        </div>
        <div className="ocr-alert-stat">
          <div className="ocr-alert-stat-value" style={{ color: 'var(--noorix-accent-green)' }}>{fmtNum(totalSavings)}</div>
          <div className="ocr-alert-stat-label">{isAr ? 'فرص التوفير (ريال)' : 'Savings (SAR)'}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="inv-toolbar">
        <label className="nx-checkbox inv-select-all-wrap">
          <input type="checkbox" checked={allChecked}
            onChange={allChecked ? () => setSelected(new Set()) : () => setSelected(new Set(visibleAlerts.map(a => a.itemId)))}
            className="inv-toolbar-checkbox" />
          <span className="inv-select-all-label">
            {selected.size > 0 ? (isAr ? `${selected.size} محدد` : `${selected.size} selected`) : (isAr ? 'تحديد الكل' : 'Select all')}
          </span>
        </label>

        <div className="inv-search-wrap">
          <span className="inv-search-icon">⌕</span>
          <Input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالصنف أو المورد...' : 'Search item or supplier...'}
            className="inv-search-input" />
          {search && <Button className="inv-search-clear" onClick={() => setSearch('')}>✕</Button>}
        </div>

        <Input type="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="inv-sort-select">
          <option value="pct">{isAr ? 'أعلى نسبة' : 'Highest %'}</option>
          <option value="savings">{isAr ? 'أكبر توفير' : 'Highest savings'}</option>
          <option value="name">{isAr ? 'الاسم' : 'Name'}</option>
        </Input>

        {selected.size > 0 && (
          <>
            <Button size="sm" onClick={dismissSelected}>
              {isAr ? `إخفاء (${selected.size})` : `Dismiss (${selected.size})`}
            </Button>
            <Button className="inv-delete-btn" onClick={handleBulkDeleteHistory} disabled={deleting}>
              {isAr ? `حذف السجل (${selected.size})` : `Delete (${selected.size})`}
            </Button>
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
        <div className="flex flex-col gap-1.5">
          {visibleAlerts.map((alert, i) => {
            const latestInvoice = invoices.find((inv) => inv.id === alert.latestInvoiceId);
            const lowestInvoice = invoices.find((inv) => inv.id === alert.lowestInvoiceId);
            const isSelected = selected.has(alert.itemId);
            const saving = (alert.latestPrice - alert.lowestPrice).toFixed(2);

            return (
              <div key={`${alert.itemId}-${i}`} className="ocr-alert-card"
                onClick={() => setComparing({ alert, latestInvoice, lowestInvoice })}
                style={isSelected ? { borderColor: 'var(--noorix-text)', background: 'var(--noorix-bg-muted)' } : {}}>

                <label className="nx-checkbox">
                  <input type="checkbox" checked={isSelected}
                    onChange={() => toggleSelect(alert.itemId)}
                    onClick={(e) => e.stopPropagation()}
                    className="ocr-catalog-checkbox" />
                </label>

                <div className="ocr-alert-icon">↑</div>

                <div className="ocr-alert-content">
                  <div className="ocr-alert-title">{alert.itemName}</div>
                  <div className="ocr-alert-detail">
                    {alert.latestSupplier} · {fmtDate(alert.latestInvoiceDate)}
                    {saving > 0 && <span className="font-semibold text-noorix-green ms-2">
                      {isAr ? `توفير ${fmtNum(saving)}` : `Save ${fmtNum(saving)}`}
                    </span>}
                  </div>
                </div>

                <div className="ocr-alert-prices">
                  <div className="ocr-alert-price">
                    <div className="ocr-alert-price-value" style={{ color: 'var(--noorix-accent-green)' }}>{fmtNum(alert.lowestPrice)}</div>
                    <div className="ocr-alert-price-label">{isAr ? 'أفضل' : 'Best'}</div>
                  </div>
                  <span className="ocr-alert-arrow">→</span>
                  <div className="ocr-alert-price">
                    <div className="ocr-alert-price-value" style={{ color: 'var(--noorix-accent-red)' }}>{fmtNum(alert.latestPrice)}</div>
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
      <Button onClick={() => { setDismissed(new Set()); try { localStorage.removeItem('noorix-dismissed-alerts'); } catch {} }}
        className="self-center">
        {isAr ? `إظهار ${dismissed.size} تنبيه مخفي` : `Show ${dismissed.size} dismissed`}
      </Button>
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

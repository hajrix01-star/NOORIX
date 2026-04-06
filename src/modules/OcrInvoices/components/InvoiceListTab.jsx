import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n/useTranslation';
import { bulkDeleteOcrInvoices } from '../services/ocrApi';
import { Input, Button } from '../../../ui';

/* ── ثوابت ──────────────────────────────────────────────────────────── */
const STATUS = {
  pending:   { bgCls: 'status--pending',   ar: 'بانتظار المراجعة', en: 'Pending' },
  confirmed: { bgCls: 'status--confirmed', ar: 'مؤكدة',            en: 'Confirmed' },
  rejected:  { bgCls: 'status--rejected',  ar: 'مرفوضة',           en: 'Rejected' },
};

const fmt    = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

/* ═══════════════════════════════════════════════════════════════════════
   عارض الصورة الاحترافي — تكبير + تصغير متعدد + تدوير + سحب
   ═══════════════════════════════════════════════════════════════════════ */
function ImageLightbox({ src, onClose }) {
  const [scale,    setScale]    = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan,      setPan]      = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart  = useRef(null);
  const imgRef     = useRef(null);

  /* ── لوحة المفاتيح ── */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')   onClose();
      if (e.key === '+'  || e.key === '=') zoomIn();
      if (e.key === '-')        zoomOut();
      if (e.key === 'r' || e.key === 'R') rotate();
      if (e.key === '0')        reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const zoomIn  = () => setScale((s) => Math.min(s + 0.25, 5));
  const zoomOut = () => setScale((s) => { const n = Math.max(s - 0.25, 0.25); if (n === 1) setPan({ x:0, y:0 }); return n; });
  const rotate  = () => setRotation((r) => (r + 90) % 360);
  const reset   = () => { setScale(1); setRotation(0); setPan({ x:0, y:0 }); };

  /* ── عجلة الماوس ── */
  const onWheel = useCallback((e) => {
    e.preventDefault();
    e.deltaY < 0 ? zoomIn() : zoomOut();
  }, []);

  /* ── سحب ── */
  const onMouseDown = (e) => {
    if (scale <= 1) return;
    setDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const onMouseMove = (e) => {
    if (!dragging || !dragStart.current) return;
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const onMouseUp = () => setDragging(false);

  const scaleLabel = `${Math.round(scale * 100)}%`;

  return createPortal(
    <div className="lb-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lb-box">

        {/* ── شريط أعلى ── */}
        <div className="lb-topbar">
          <div className="lb-scale-label">{scaleLabel}</div>
          <div className="lb-controls">
            <Button className="lb-btn" onClick={zoomOut}  title="تصغير (-)">−</Button>
            <Button className="lb-btn" onClick={zoomIn}   title="تكبير (+)">+</Button>
            <Button className="lb-btn" onClick={rotate}   title="تدوير (R)">↺</Button>
            <Button className="lb-btn" onClick={reset}    title="إعادة تعيين (0)">⊙</Button>
            <Button className="lb-btn lb-btn--close" onClick={onClose} title="إغلاق (Esc)">✕</Button>
          </div>
        </div>

        {/* ── منطقة الصورة ── */}
        <div
          className="lb-stage"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{ cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in' }}
          onClick={() => { if (!dragging) zoomIn(); }}
        >
          <img
            ref={imgRef}
            src={src}
            alt="invoice"
            className="lb-img"
            draggable={false}
            style={{
              transform: `translate(${pan.x}px,${pan.y}px) rotate(${rotation}deg) scale(${scale})`,
            }}
          />
        </div>

        {/* ── شريط تحت ── */}
        <div className="lb-bottombar">
          <div className="lb-hint">
            {scale <= 1 ? 'انقر أو استخدم العجلة للتكبير · R للتدوير · Esc للإغلاق'
                        : 'اسحب للتنقل · العجلة للتكبير/التصغير · 0 لإعادة التعيين'}
          </div>
          <div className="lb-zoom-strip">
            {[0.5, 1, 1.5, 2, 3, 4].map((z) => (
              <Button key={z} className={`lb-zoom-dot${scale === z ? ' lb-zoom-dot--active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setScale(z); if (z === 1) setPan({x:0,y:0}); }}>
                {z === 1 ? '1×' : `${z}×`}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   نافذة تفاصيل الفاتورة
   ═══════════════════════════════════════════════════════════════════════ */
function InvoiceDetailModal({ invoice, language, onClose, onLightbox }) {
  const isAr     = language === 'ar';
  const dir      = isAr ? 'rtl' : 'ltr';
  const statusInfo = STATUS[invoice.status] || STATUS.pending;
  const supplierName = isAr
    ? (invoice.supplier?.nameAr || '—')
    : (invoice.supplier?.nameEn || invoice.supplier?.nameAr || '—');

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" dir={dir}>

        {/* رأس */}
        <div className="modal-head">
          <div>
            <div className="modal-title">{isAr ? 'تفاصيل الفاتورة' : 'Invoice Details'}</div>
            <div className="modal-sub">{supplierName}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`status-badge ${statusInfo.bgCls}`}>
              {isAr ? statusInfo.ar : statusInfo.en}
            </span>
            <Button className="modal-close-btn" onClick={onClose}>✕</Button>
          </div>
        </div>

        <div className="modal-body">
          {/* ── صورة الفاتورة ── */}
          {invoice.imageUrl && (
            <div className="inv-img-wrap" onClick={() => onLightbox(invoice.imageUrl)}>
              <img src={invoice.imageUrl} alt="invoice" className="inv-img-thumb" />
              <div className="inv-img-overlay">⊕</div>
            </div>
          )}

          {/* ── بطاقات المعلومات ── */}
          <div className="inv-meta-grid">
            {[
              { label: isAr ? 'المورد'         : 'Supplier',      value: supplierName },
              { label: isAr ? 'رقم الفاتورة'   : 'Invoice #',     value: invoice.invoiceNumber || '—' },
              { label: isAr ? 'تاريخ الفاتورة' : 'Invoice Date',  value: fmtDate(invoice.invoiceDate) },
              { label: isAr ? 'تاريخ الرفع'    : 'Uploaded',      value: fmtDate(invoice.createdAt) },
              { label: isAr ? 'المجموع قبل الضريبة' : 'Subtotal', value: invoice.subtotalAmount ? `${fmt(invoice.subtotalAmount)} ${isAr ? 'ريال' : 'SAR'}` : '—' },
              { label: isAr ? 'الضريبة'        : 'VAT',           value: invoice.vatAmount    ? `${fmt(invoice.vatAmount)} ${isAr ? 'ريال' : 'SAR'}` : '—' },
              { label: isAr ? 'الإجمالي شامل الضريبة' : 'Total',  value: invoice.totalAmount  ? `${fmt(invoice.totalAmount)} ${isAr ? 'ريال' : 'SAR'}` : '—', highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`inv-meta-cell${highlight ? ' inv-meta-cell--hl' : ''}`}>
                <div className="inv-meta-label">{label}</div>
                <div className="inv-meta-value">{value}</div>
              </div>
            ))}
          </div>

          {/* ── الأصناف ── */}
          {invoice.lines?.length > 0 && (
            <div className="inv-lines">
              <div className="inv-lines-header">
                {isAr ? `الأصناف (${invoice.lines.length})` : `Items (${invoice.lines.length})`}
              </div>
              <div className="inv-lines-table">
                <div className="inv-lines-thead">
                  <span>{isAr ? 'الصنف' : 'Item'}</span>
                  <span style={{ textAlign: 'center' }}>{isAr ? 'الكمية' : 'Qty'}</span>
                  <span style={{ textAlign: 'center' }}>{isAr ? 'السعر' : 'Price'}</span>
                  <span style={{ textAlign: 'center' }}>{isAr ? 'الإجمالي' : 'Total'}</span>
                </div>
                {invoice.lines.map((line, i) => (
                  <div key={i} className="inv-lines-row">
                    <div className="inv-line-name">
                      {line.nameAr || line.item?.nameAr || line.rawName}
                      {line.nameEn && line.nameEn !== (line.nameAr || '') && (
                        <span className="inv-line-en"> / {line.nameEn || line.item?.nameEn}</span>
                      )}
                      {line.size && (
                        <span className="inv-line-size">{line.size}{line.sizeUnit || ''}</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'center' }}>{line.quantity ?? '—'}</div>
                    <div style={{ textAlign: 'center' }}>{line.unitPrice  != null ? fmt(line.unitPrice)  : '—'}</div>
                    <div style={{ textAlign: 'center', fontWeight: 700 }}>{line.totalPrice != null ? fmt(line.totalPrice) : '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   بطاقة الفاتورة
   ═══════════════════════════════════════════════════════════════════════ */
function InvoiceCard({ invoice, language, isSelected, onSelect, onClick, onLightbox }) {
  const isAr = language === 'ar';
  const statusInfo = STATUS[invoice.status] || STATUS.pending;
  const supplierName = isAr
    ? (invoice.supplier?.nameAr || (isAr ? 'مورد غير محدد' : 'Unknown'))
    : (invoice.supplier?.nameEn || invoice.supplier?.nameAr || 'Unknown');

  return (
    <div
      className={`inv-card${isSelected ? ' inv-card--selected' : ''}`}
      onClick={onClick}
    >
      {/* ── منطقة الصورة ── */}
      <div className="inv-card-img-wrap">
        {invoice.imageUrl ? (
          <img src={invoice.imageUrl} alt="" className="inv-card-img" />
        ) : (
          <div className="inv-card-no-img">—</div>
        )}
        {invoice.imageUrl && (
          <div className="inv-card-img-hover" onClick={(e) => { e.stopPropagation(); onLightbox(invoice.imageUrl); }}>
            <span className="inv-card-zoom-icon">⊕</span>
          </div>
        )}
        {/* checkbox */}
        <label className="inv-card-checkbox-wrap" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox" checked={isSelected}
            onChange={() => onSelect(invoice.id)}
            className="inv-card-checkbox"
          />
        </label>
        {/* status badge */}
        <span className={`inv-card-status ${statusInfo.bgCls}`}>
          {isAr ? statusInfo.ar : statusInfo.en}
        </span>
      </div>

      {/* ── معلومات ── */}
      <div className="inv-card-body">
        <div className="inv-card-supplier">{supplierName}</div>
        <div className="inv-card-meta">
          {invoice.invoiceNumber && <span># {invoice.invoiceNumber}</span>}
          {invoice.invoiceDate   && <span>{fmtDate(invoice.invoiceDate)}</span>}
        </div>
        <div className="inv-card-footer">
          <span className="inv-card-total">
            {invoice.totalAmount ? `${fmt(invoice.totalAmount)} ${isAr ? 'ريال' : 'SAR'}` : '—'}
          </span>
          <span className="inv-card-items">
            {invoice.lines?.length || 0} {isAr ? 'صنف' : 'items'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   التبويب الرئيسي
   ═══════════════════════════════════════════════════════════════════════ */
export default function InvoiceListTab({ invoices = [], loading, onRefresh }) {
  const { language } = useTranslation();
  const isAr = language === 'ar';
  const dir  = isAr ? 'rtl' : 'ltr';

  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState(new Set());
  const [viewing,   setViewing]   = useState(null);
  const [lightbox,  setLightbox]  = useState(null);   // URL الصورة المكبرة
  const [deleting,  setDeleting]  = useState(false);
  const [sortBy,    setSortBy]    = useState('date-desc');

  /* ── فلترة وترتيب ── */
  const filtered = (() => {
    const q = search.toLowerCase();
    let list = invoices.filter((inv) =>
      !q ||
      inv.supplier?.nameAr?.toLowerCase().includes(q) ||
      inv.supplier?.nameEn?.toLowerCase().includes(q) ||
      inv.invoiceNumber?.toLowerCase().includes(q)
    );
    if (sortBy === 'date-desc') list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sortBy === 'date-asc')  list = [...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (sortBy === 'amount')    list = [...list].sort((a, b) => Number(b.totalAmount || 0) - Number(a.totalAmount || 0));
    if (sortBy === 'supplier')  list = [...list].sort((a, b) => (a.supplier?.nameAr || '').localeCompare(b.supplier?.nameAr || '', 'ar'));
    return list;
  })();

  /* ── تحديد ── */
  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const selectAll  = () => setSelected(new Set(filtered.map((inv) => inv.id)));
  const clearAll   = () => setSelected(new Set());
  const allChecked = filtered.length > 0 && filtered.every((inv) => selected.has(inv.id));

  /* ── حذف ── */
  const handleBulkDelete = async () => {
    if (!selected.size) return;
    const count = selected.size;
    if (!window.confirm(isAr ? `حذف ${count} فاتورة؟ لا يمكن التراجع.` : `Delete ${count} invoice(s)? This cannot be undone.`)) return;
    setDeleting(true);
    await bulkDeleteOcrInvoices([...selected]);
    setSelected(new Set());
    setDeleting(false);
    onRefresh?.();
  };

  if (loading) return (
    <div className="ocr-loading">
      <div className="ocr-spinner" />
      <span>{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
    </div>
  );

  return (
    <div dir={dir} className="inv-list-root">

      {/* ── شريط الأدوات ─────────────────────────────────────────────── */}
      <div className="inv-toolbar">
        {/* Select all */}
        <label className="inv-select-all-wrap">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={allChecked ? clearAll : selectAll}
            className="inv-toolbar-checkbox"
          />
          <span className="inv-select-all-label">
            {selected.size > 0
              ? (isAr ? `${selected.size} محدد` : `${selected.size} selected`)
              : (isAr ? 'تحديد الكل' : 'Select all')}
          </span>
        </label>

        <div className="inv-search-wrap">
          <span className="inv-search-icon">⌕</span>
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالمورد أو رقم الفاتورة...' : 'Search supplier or invoice #...'}
            className="inv-search-input"
          />
          {search && <Button className="inv-search-clear" onClick={() => setSearch('')}>✕</Button>}
        </div>

        {/* ترتيب */}
        <Input type="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="inv-sort-select">
          <option value="date-desc">{isAr ? 'الأحدث أولاً' : 'Newest first'}</option>
          <option value="date-asc">{isAr ? 'الأقدم أولاً' : 'Oldest first'}</option>
          <option value="amount">{isAr ? 'أعلى مبلغ' : 'Highest amount'}</option>
          <option value="supplier">{isAr ? 'اسم المورد' : 'Supplier name'}</option>
        </Input>

        {selected.size > 0 && (
          <Button className="inv-delete-btn" variant="danger" onClick={handleBulkDelete} disabled={deleting}>
            {isAr ? `حذف (${selected.size})` : `Delete (${selected.size})`}
          </Button>
        )}
      </div>

      {/* ── الشبكة ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="ocr-empty">
          <div className="ocr-empty-icon">—</div>
          <div className="ocr-empty-text">{isAr ? 'لا توجد فواتير محفوظة بعد' : 'No invoices saved yet'}</div>
          <div className="ocr-empty-sub">{isAr ? 'ارفع فاتورة من تبويب "رفع فاتورة"' : 'Upload an invoice to get started'}</div>
        </div>
      ) : (
        <div className="inv-grid">
          {filtered.map((inv) => (
            <InvoiceCard
              key={inv.id}
              invoice={inv}
              language={language}
              isSelected={selected.has(inv.id)}
              onSelect={toggleSelect}
              onClick={() => setViewing(inv)}
              onLightbox={(src) => { if (src) setLightbox(src); }}
            />
          ))}
        </div>
      )}

      {/* ── نافذة التفاصيل ── */}
      {viewing && (
        <InvoiceDetailModal
          invoice={viewing}
          language={language}
          onClose={() => setViewing(null)}
          onLightbox={(src) => { if (src) setLightbox(src); }}
        />
      )}

      {/* ── Lightbox ── */}
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

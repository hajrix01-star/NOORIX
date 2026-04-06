import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n/useTranslation';

const STATUS_STYLES = {
  pending:   { bg: 'rgba(245,158,11,0.12)', color: '#d97706', label: { ar: 'بانتظار المراجعة', en: 'Pending' } },
  confirmed: { bg: 'rgba(22,163,74,0.12)',  color: '#16a34a', label: { ar: 'مؤكدة', en: 'Confirmed' } },
  rejected:  { bg: 'rgba(220,38,38,0.12)',  color: '#dc2626', label: { ar: 'مرفوضة', en: 'Rejected' } },
};

const fmtNum  = (n) => Number(n).toLocaleString('en-US');
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/* ── عارض صورة الفاتورة — تكبير داخل النافذة ─────────────────────── */
function InvoiceImageViewer({ src }) {
  const [rotation, setRotation] = useState(0);
  const [zoomed,   setZoomed]   = useState(false);

  if (!src) return null;

  const rotate = () => setRotation((r) => (r + 90) % 360);

  return (
    <div style={{ marginBottom: 20 }}>
      {/* الصورة المصغرة */}
      {!zoomed && (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <img
            src={src}
            alt="invoice"
            style={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block',
              transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s ease' }}
          />
          <div style={{ position: 'absolute', bottom: 10, insetInlineEnd: 10, display: 'flex', gap: 6 }}>
            <button type="button" onClick={rotate} title="تدوير"
              style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(0,0,0,0.55)', border: 'none',
                color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
              🔄
            </button>
            <button type="button" onClick={() => setZoomed(true)} title="تكبير"
              style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(0,0,0,0.55)', border: 'none',
                color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
              🔍
            </button>
          </div>
        </div>
      )}

      {/* عرض مكبّر داخل النافذة — بدون فتح صفحة جديدة */}
      {zoomed && (
        <div style={{ borderRadius: 12, background: '#111', padding: 12, position: 'relative' }}>
          <div style={{ overflowY: 'auto', maxHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={src}
              alt="invoice zoomed"
              style={{ maxWidth: '100%', objectFit: 'contain',
                transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s ease',
                cursor: 'zoom-in', touchAction: 'pinch-zoom' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'center' }}>
            <button type="button" onClick={rotate}
              style={{ padding: '7px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              🔄 تدوير
            </button>
            <button type="button" onClick={() => setZoomed(false)}
              style={{ padding: '7px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              ✕ تصغير
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvoiceListTab({ invoices = [], loading }) {
  const { t, language } = useTranslation();
  const [search, setSearch]   = useState('');
  const [viewing, setViewing] = useState(null);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    return (
      !q ||
      inv.supplier?.nameAr?.toLowerCase().includes(q) ||
      inv.invoiceNumber?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--noorix-text-muted)' }}>
        ⏳ جاري التحميل...
      </div>
    );
  }

  return (
    <div dir={dir} style={{ minHeight: 0 }}>

      {/* شريط البحث */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('ocrSearch')}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            border: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
            color: 'var(--noorix-text)', fontSize: 14, boxSizing: 'border-box',
          }}
        />
      </div>

      {/* قائمة الفواتير */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--noorix-text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div>{t('ocrNoInvoices')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((inv) => {
            const statusInfo = STATUS_STYLES[inv.status] || STATUS_STYLES.pending;
            return (
              <div
                key={inv.id}
                onClick={() => setViewing(inv)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid var(--noorix-border)',
                  background: 'var(--noorix-bg-surface)',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = 'var(--noorix-accent-blue)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--noorix-border)'; }}
              >
                {/* أيقونة — صورة مصغرة */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, overflow: 'hidden',
                }}>
                  {inv.imageUrl
                    ? <img src={inv.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '📄'
                  }
                </div>

                {/* معلومات رئيسية */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--noorix-text)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {language === 'en' ? (inv.supplier?.nameEn || inv.supplier?.nameAr || 'Unknown') : (inv.supplier?.nameAr || 'مورد غير محدد')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {inv.invoiceNumber && <span># {inv.invoiceNumber}</span>}
                    {inv.invoiceDate && <span>📅 {fmtDate(inv.invoiceDate)}</span>}
                    {inv.createdAt   && <span>⬆️ {fmtDate(inv.createdAt)}</span>}
                    <span>{inv.lines?.length || 0} {language === 'en' ? 'items' : 'صنف'}</span>
                  </div>
                </div>

                {/* المبلغ والحالة */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {inv.totalAmount && (
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--noorix-text)' }}>
                      {fmtNum(inv.totalAmount)} {language === 'en' ? 'SAR' : 'ريال'}
                    </div>
                  )}
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: statusInfo.bg, color: statusInfo.color, whiteSpace: 'nowrap',
                  }}>
                    {language === 'ar' ? statusInfo.label.ar : statusInfo.label.en}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal تفاصيل الفاتورة */}
      {viewing && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          role="dialog" aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setViewing(null)}
        >
          <div
            dir={dir}
            style={{
              background: '#ffffff',
              borderRadius: 16,
              maxWidth: 640,
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              border: '1px solid #e5e7eb',
            }}
          >
            {/* رأس النافذة */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid var(--noorix-border)',
              position: 'sticky', top: 0, background: '#ffffff', zIndex: 1,
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  {language === 'ar' ? 'تفاصيل الفاتورة' : 'Invoice Details'}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 2 }}>
                  {language === 'en' ? (viewing.supplier?.nameEn || viewing.supplier?.nameAr) : (viewing.supplier?.nameAr || 'مورد غير محدد')}
                </div>
              </div>
              <button
                onClick={() => setViewing(null)}
                style={{
                  background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)',
                  borderRadius: 8, cursor: 'pointer', fontSize: 16,
                  color: 'var(--noorix-text-muted)', width: 34, height: 34,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>

            <div style={{ padding: '16px 20px' }}>

              {/* ── صورة الفاتورة ── */}
              {viewing.imageUrl && <InvoiceImageViewer src={viewing.imageUrl} />}

              {/* معلومات الفاتورة */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px 16px',
                marginBottom: 16, padding: 14,
                background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb',
              }}>
                {[
                  { label: language === 'ar' ? 'المورد'         : 'Supplier',      value: (language === 'en' ? viewing.supplier?.nameEn : null) || viewing.supplier?.nameAr || '—' },
                  { label: language === 'ar' ? 'رقم الفاتورة'   : 'Invoice #',     value: viewing.invoiceNumber || '—' },
                  { label: language === 'ar' ? 'تاريخ الفاتورة' : 'Invoice Date',  value: viewing.invoiceDate ? fmtDate(viewing.invoiceDate) : '—' },
                  { label: language === 'ar' ? 'تاريخ الرفع'    : 'Upload Date',   value: viewing.createdAt   ? fmtDate(viewing.createdAt)   : '—' },
                  { label: language === 'ar' ? 'الإجمالي'       : 'Total',         value: viewing.totalAmount ? `${fmtNum(viewing.totalAmount)} ${language === 'en' ? 'SAR' : 'ريال'}` : '—' },
                  { label: language === 'ar' ? 'ضريبة القيمة'   : 'VAT',           value: viewing.vatAmount   ? `${fmtNum(viewing.vatAmount)} ${language === 'en' ? 'SAR' : 'ريال'}`   : '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* قائمة الأصناف */}
              {viewing.lines?.length > 0 && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                    📦 {language === 'ar' ? `الأصناف (${viewing.lines.length})` : `Items (${viewing.lines.length})`}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {viewing.lines.map((line, i) => (
                      <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            {line.nameAr || line.item?.nameAr || line.rawName}
                            {line.nameEn ? ` / ${line.nameEn}` : ''}
                          </span>
                          {line.size && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                              {line.size}{line.sizeUnit || ''}
                            </span>
                          )}
                        </div>
                        {line.rawName !== (line.nameAr || line.item?.nameAr) && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>OCR: {line.rawName}</div>
                        )}
                        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#6b7280', flexWrap: 'wrap' }}>
                          {line.quantity  != null && <span>{language === 'ar' ? 'الكمية'  : 'Qty'}:   <strong>{line.quantity}</strong></span>}
                          {line.unitPrice != null && <span>{language === 'ar' ? 'السعر'   : 'Price'}: <strong>{fmtNum(line.unitPrice)}</strong></span>}
                          {line.totalPrice != null && <span>{language === 'ar' ? 'الإجمالي' : 'Total'}: <strong>{fmtNum(line.totalPrice)}</strong></span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

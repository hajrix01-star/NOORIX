import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n/useTranslation';

const STATUS_STYLES = {
  pending:   { bg: 'rgba(245,158,11,0.12)', color: '#d97706', label: { ar: 'بانتظار المراجعة', en: 'Pending' } },
  confirmed: { bg: 'rgba(22,163,74,0.12)',  color: '#16a34a', label: { ar: 'مؤكدة', en: 'Confirmed' } },
  rejected:  { bg: 'rgba(220,38,38,0.12)',  color: '#dc2626', label: { ar: 'مرفوضة', en: 'Rejected' } },
};

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
                  padding: '14px 18px',
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
                {/* أيقونة */}
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>📄</div>

                {/* معلومات رئيسية */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--noorix-text)', marginBottom: 3 }}>
                    {inv.supplier?.nameAr || 'مورد غير محدد'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {inv.invoiceNumber && <span># {inv.invoiceNumber}</span>}
                    {inv.invoiceDate && (
                      <span>{new Date(inv.invoiceDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
                    )}
                    <span>{inv.lines?.length || 0} صنف</span>
                  </div>
                </div>

                {/* المبلغ والحالة */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {inv.totalAmount && (
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--noorix-text)' }}>
                      {Number(inv.totalAmount).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')} ريال
                    </div>
                  )}
                  <span style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: statusInfo.bg, color: statusInfo.color,
                    whiteSpace: 'nowrap',
                  }}>
                    {language === 'ar' ? statusInfo.label.ar : statusInfo.label.en}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal تفاصيل الفاتورة — مع createPortal لتجنب مشاكل الـ overflow */}
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
              maxHeight: '88vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              border: '1px solid #e5e7eb',
            }}
          >
            {/* رأس النافذة */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '20px 24px 16px',
              borderBottom: '1px solid var(--noorix-border)',
              position: 'sticky', top: 0, background: '#ffffff', zIndex: 1,
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>تفاصيل الفاتورة</h3>
                <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 2 }}>
                  {viewing.supplier?.nameAr || 'مورد غير محدد'}
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

            <div style={{ padding: '20px 24px' }}>
              {/* معلومات الفاتورة */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px',
                marginBottom: 20, padding: 16,
                background: '#f9fafb',
                borderRadius: 12, border: '1px solid #e5e7eb',
              }}>
                {[
                  { label: 'المورد',        value: viewing.supplier?.nameAr || '—' },
                  { label: 'رقم الفاتورة', value: viewing.invoiceNumber || '—' },
                  { label: 'التاريخ',       value: viewing.invoiceDate ? new Date(viewing.invoiceDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '—' },
                  { label: 'الإجمالي',      value: viewing.totalAmount ? `${Number(viewing.totalAmount).toLocaleString('ar-SA')} ريال` : '—' },
                  { label: 'ضريبة القيمة', value: viewing.vatAmount ? `${Number(viewing.vatAmount).toLocaleString('ar-SA')} ريال` : '—' },
                  { label: 'عدد الأصناف',  value: `${viewing.lines?.length || 0} صنف` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* قائمة الأصناف */}
              {viewing.lines?.length > 0 && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                    📦 الأصناف ({viewing.lines.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {viewing.lines.map((line, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px 14px', borderRadius: 10,
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>
                            {line.nameAr || line.item?.nameAr || line.rawName}
                            {line.nameEn ? ` / ${line.nameEn}` : ''}
                          </span>
                          {line.size && (
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                              background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                            }}>
                              {line.size}{line.sizeUnit || ''}
                            </span>
                          )}
                        </div>
                        {line.rawName !== (line.nameAr || line.item?.nameAr) && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                            OCR: {line.rawName}
                          </div>
                        )}
                        <div style={{
                          display: 'flex', gap: 16, fontSize: 12,
                          color: '#6b7280', flexWrap: 'wrap',
                        }}>
                          {line.quantity  && <span>الكمية: <strong>{line.quantity}</strong></span>}
                          {line.unitPrice && <span>السعر: <strong>{Number(line.unitPrice).toLocaleString('ar-SA')}</strong></span>}
                          {line.totalPrice && <span>الإجمالي: <strong>{Number(line.totalPrice).toLocaleString('ar-SA')}</strong></span>}
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

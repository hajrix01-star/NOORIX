import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';

const STATUS_STYLES = {
  pending:   { bg: '#fef3c7', color: '#92400e', label: { ar: 'بانتظار المراجعة', en: 'Pending' } },
  confirmed: { bg: '#dcfce7', color: '#15803d', label: { ar: 'مؤكدة', en: 'Confirmed' } },
  rejected:  { bg: '#fee2e2', color: '#b91c1c', label: { ar: 'مرفوضة', en: 'Rejected' } },
};

export default function InvoiceListTab({ invoices = [], loading }) {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState('');
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
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--noorix-text-muted)' }}>⏳ جاري التحميل...</div>;
  }

  return (
    <div dir={dir}>
      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('ocrSearch')}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
            color: 'var(--noorix-text)', fontSize: 14, boxSizing: 'border-box',
          }}
        />
      </div>

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
                className="noorix-surface-card"
                style={{ padding: '14px 18px', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {inv.supplier?.nameAr || 'مورد غير محدد'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 2 }}>
                      {inv.invoiceNumber && `# ${inv.invoiceNumber}`}
                      {inv.invoiceDate && ` · ${new Date(inv.invoiceDate).toLocaleDateString('ar-SA')}`}
                      {` · ${inv.lines?.length || 0} صنف`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {inv.totalAmount && (
                      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--noorix-accent-blue)' }}>
                        {Number(inv.totalAmount).toLocaleString('ar-SA')} ريال
                      </div>
                    )}
                    <span style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: statusInfo.bg, color: statusInfo.color,
                    }}>
                      {language === 'ar' ? statusInfo.label.ar : statusInfo.label.en}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة تفاصيل الفاتورة */}
      {viewing && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          role="dialog" aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setViewing(null)}
        >
          <div className="noorix-surface-card" style={{ maxWidth: 600, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24 }} dir={dir}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>تفاصيل الفاتورة</h3>
              <button onClick={() => setViewing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--noorix-text-muted)' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'المورد', value: viewing.supplier?.nameAr || '—' },
                { label: 'رقم الفاتورة', value: viewing.invoiceNumber || '—' },
                { label: 'التاريخ', value: viewing.invoiceDate ? new Date(viewing.invoiceDate).toLocaleDateString('ar-SA') : '—' },
                { label: 'الإجمالي', value: viewing.totalAmount ? `${Number(viewing.totalAmount).toLocaleString('ar-SA')} ريال` : '—' },
                { label: 'الضريبة', value: viewing.vatAmount ? `${Number(viewing.vatAmount).toLocaleString('ar-SA')} ريال` : '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--noorix-border)' }}>
                  <span style={{ color: 'var(--noorix-text-muted)', fontSize: 13, minWidth: 100 }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>

            {viewing.lines?.length > 0 && (
              <>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>الأصناف ({viewing.lines.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {viewing.lines.map((line, i) => (
                    <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)' }}>
                      <div style={{ fontWeight: 600 }}>{line.item?.nameAr || line.rawName}</div>
                      {line.rawName !== line.item?.nameAr && line.item && (
                        <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>OCR: {line.rawName}</div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {line.quantity && <span>الكمية: {line.quantity}</span>}
                        {line.unitPrice && <span>السعر: {Number(line.unitPrice).toLocaleString('ar-SA')}</span>}
                        {line.totalPrice && <span>الإجمالي: {Number(line.totalPrice).toLocaleString('ar-SA')}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

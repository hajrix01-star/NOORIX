import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { extractInvoice, saveOcrInvoice } from '../services/ocrApi';

const CONFIDENCE_COLOR = (c) => {
  if (c >= 0.9) return '#16a34a';
  if (c >= 0.7) return '#d97706';
  return '#dc2626';
};

const STATUS_BADGE = {
  auto:    { bg: '#dcfce7', color: '#15803d', label: { ar: 'تلقائي', en: 'Auto' } },
  review:  { bg: '#fef3c7', color: '#92400e', label: { ar: 'راجع', en: 'Review' } },
  new:     { bg: '#fee2e2', color: '#b91c1c', label: { ar: 'جديد', en: 'New' } },
};

export default function InvoiceUploadTab({ suppliers, items, onSaved }) {
  const { t, language } = useTranslation();
  const [dragging, setDragging]   = useState(false);
  const [preview, setPreview]     = useState(null);
  const [imageBase64, setBase64]  = useState(null);
  const [mimeType, setMimeType]   = useState('image/jpeg');
  const [extracted, setExtracted] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(false);
  const fileRef = useRef();

  const readFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setPreview(dataUrl);
      const base64 = dataUrl.split(',')[1];
      setBase64(base64);
      setExtracted(null);
      setError(null);
      setSuccess(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    readFile(file);
  }, [readFile]);

  const handleExtract = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setError(null);
    try {
      const res = await extractInvoice(imageBase64, mimeType);
      if (res.success) {
        if (res.data?.parseError) {
          setError(t('ocrExtractFailed') + ' — تعذّر قراءة نص الفاتورة. تأكد من وضوح الصورة وأنها فاتورة حقيقية.');
        } else {
          setExtracted(res.data);
        }
      } else {
        setError(res.error || t('ocrExtractFailed'));
      }
    } catch {
      setError(t('ocrExtractFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!extracted) return;
    setSaving(true);
    setError(null);
    try {
      const lines = (extracted.items || []).map((item) => ({
        rawName:     item.name || '',
        nameAr:      item.nameAr || null,
        nameEn:      item.nameEn || null,
        size:        item.size || null,
        sizeUnit:    item.sizeUnit || null,
        itemId:      item.itemMatch?.id || null,
        quantity:    item.quantity || null,
        unitPrice:   item.unitPrice || null,
        totalPrice:  item.totalPrice || null,
        confidence:  item.confidence || 0,
        matchStatus: item.itemMatch?.status || 'pending',
      }));

      const payload = {
        supplierId:    extracted.supplierMatch?.id || null,
        // إذا لم يكن هناك مطابقة، أرسل الاسم المستخرج لإنشاء المورد تلقائياً
        supplierName:  !extracted.supplierMatch?.id ? (extracted.supplier?.name || null) : null,
        invoiceNumber: extracted.invoiceNumber?.value || null,
        invoiceDate:   extracted.invoiceDate?.value || null,
        totalAmount:   extracted.totalAmount?.value || null,
        vatAmount:     extracted.vatAmount?.value || null,
        rawExtraction: extracted,
        lines,
      };

      const res = await saveOcrInvoice(payload);
      if (res.success) {
        setSuccess(true);
        onSaved?.();
        setTimeout(() => {
          setPreview(null);
          setBase64(null);
          setExtracted(null);
          setSuccess(false);
        }, 2000);
      } else {
        setError(res.error || t('ocrExtractFailed'));
      }
    } catch {
      setError(t('ocrExtractFailed'));
    } finally {
      setSaving(false);
    }
  };

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} dir={dir}>

      {/* منطقة الرفع */}
      {!preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--noorix-accent-blue)' : 'var(--noorix-border)'}`,
            borderRadius: 16,
            padding: '60px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'rgba(59,130,246,0.06)' : 'var(--noorix-bg-surface)',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--noorix-text)' }}>{t('ocrDragDrop')}</div>
          <div style={{ fontSize: 13, color: 'var(--noorix-text-muted)', marginTop: 6 }}>{t('ocrSupportedFormats')}</div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => readFile(e.target.files[0])} />
        </div>
      )}

      {/* معاينة الصورة */}
      {preview && (
        <div style={{ display: 'grid', gridTemplateColumns: extracted ? '1fr 1fr' : '1fr', gap: 20, alignItems: 'start' }}>
          <div className="noorix-surface-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>صورة الفاتورة</span>
              <button
                onClick={() => { setPreview(null); setBase64(null); setExtracted(null); setError(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--noorix-text-muted)', fontSize: 18 }}
              >✕</button>
            </div>
            <img src={preview} alt="invoice" style={{ width: '100%', borderRadius: 8, maxHeight: 500, objectFit: 'contain' }} />
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!extracted && (
                <button
                  onClick={handleExtract}
                  disabled={loading}
                  className="noorix-btn noorix-btn--primary"
                  style={{ flex: 1 }}
                >
                  {loading ? `⏳ ${t('ocrExtracting')}` : `🔍 ${t('ocrExtract')}`}
                </button>
              )}
              {extracted && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving || success}
                    className="noorix-btn noorix-btn--primary"
                    style={{ flex: 1 }}
                  >
                    {saving ? `⏳ ${t('ocrSaving')}` : success ? `✅ ${t('ocrSaved')}` : `💾 ${t('ocrSaveInvoice')}`}
                  </button>
                  <button
                    onClick={handleExtract}
                    disabled={loading}
                    className="noorix-btn"
                    style={{ flex: 1 }}
                  >
                    {loading ? t('ocrExtracting') : '🔄 إعادة استخراج'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* نتيجة الاستخراج */}
          {extracted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* معلومات الفاتورة */}
              <div className="noorix-surface-card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📋 معلومات الفاتورة</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <FieldRow label={t('ocrSupplierField')} value={extracted.supplier?.name} confidence={extracted.supplier?.confidence} match={extracted.supplierMatch} />
                  <FieldRow label={t('ocrVatNumber')} value={extracted.vatNumber?.value} confidence={extracted.vatNumber?.confidence} />
                  <FieldRow label={t('ocrInvoiceNumber')} value={extracted.invoiceNumber?.value} confidence={extracted.invoiceNumber?.confidence} />
                  <FieldRow label={t('ocrInvoiceDate')} value={extracted.invoiceDate?.value} confidence={extracted.invoiceDate?.confidence} />
                  <FieldRow label={t('ocrTotalAmount')} value={extracted.totalAmount?.value ? `${extracted.totalAmount.value} ريال` : null} confidence={extracted.totalAmount?.confidence} />
                  <FieldRow label={t('ocrVatAmount')} value={extracted.vatAmount?.value ? `${extracted.vatAmount.value} ريال` : null} confidence={extracted.vatAmount?.confidence} />
                </div>
              </div>

              {/* الأصناف */}
              {extracted.items?.length > 0 && (
                <div className="noorix-surface-card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📦 {t('ocrItems')} ({extracted.items.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {extracted.items.map((item, i) => (
                      <ItemRow key={i} item={item} language={language} t={t} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(220,38,38,0.1)', color: '#dc2626', fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, confidence, match }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--noorix-border)' }}>
      <span style={{ fontSize: 13, color: 'var(--noorix-text-muted)', minWidth: 100 }}>{label}</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--noorix-text)' }}>{value || '—'}</span>
        {match && (
          <div style={{ fontSize: 11, marginTop: 2 }}>
            <span style={{
              padding: '2px 6px', borderRadius: 4,
              background: match.status === 'auto' ? '#dcfce7' : '#fef3c7',
              color: match.status === 'auto' ? '#15803d' : '#92400e',
            }}>
              ↳ {match.nameAr} ({Math.round(match.score * 100)}%)
            </span>
          </div>
        )}
      </div>
      {confidence !== undefined && (
        <span style={{ fontSize: 11, color: CONFIDENCE_COLOR(confidence), fontWeight: 700 }}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  );
}

function ItemRow({ item, language, t }) {
  const match = item.itemMatch;
  const statusInfo = match ? STATUS_BADGE[match.status] : STATUS_BADGE.new;

  // بناء عرض الاسم: عربي + إنجليزي + حجم
  const displayName = [item.nameAr, item.nameEn].filter(Boolean).join(' / ') || item.name || '—';
  const sizeLabel = item.size ? `${item.size}${item.sizeUnit || ''}` : null;

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 10,
      background: 'var(--noorix-bg-surface)',
      border: '1px solid var(--noorix-border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          {/* الاسم الأساسي */}
          <div style={{ fontWeight: 600, fontSize: 14 }}>{displayName}</div>

          {/* الحجم */}
          {sizeLabel && (
            <span style={{
              display: 'inline-block', marginTop: 3,
              fontSize: 11, fontWeight: 700,
              padding: '2px 8px', borderRadius: 20,
              background: 'rgba(99,102,241,0.1)', color: '#6366f1',
            }}>
              📏 {sizeLabel}
            </span>
          )}

          {/* الاسم الكامل كما في الفاتورة (إذا كان مختلفاً) */}
          {item.name && item.name !== displayName && (
            <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 2 }}>
              OCR: {item.name}
            </div>
          )}

          {/* المطابقة في الكتالوج */}
          {match && (
            <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)', marginTop: 2 }}>
              ↳ {match.nameAr}{match.nameEn ? ` / ${match.nameEn}` : ''}
              {match.hasSizes && <span style={{ marginRight: 4, color: '#6366f1' }}>• متعدد الأحجام</span>}
            </div>
          )}
        </div>
        <span style={{
          fontSize: 11, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
          background: statusInfo.bg, color: statusInfo.color, fontWeight: 700,
        }}>
          {language === 'ar' ? statusInfo.label.ar : statusInfo.label.en}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: 'var(--noorix-text-muted)', flexWrap: 'wrap' }}>
        {item.quantity  && <span>الكمية: <strong>{item.quantity}</strong></span>}
        {item.unitPrice && <span>السعر: <strong>{item.unitPrice}</strong></span>}
        {item.totalPrice && <span>الإجمالي: <strong>{item.totalPrice}</strong></span>}
        {item.confidence != null && (
          <span style={{ color: CONFIDENCE_COLOR(item.confidence) }}>
            دقة: {Math.round(item.confidence * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}

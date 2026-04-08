import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input } from '../../../ui';
import { extractInvoice, saveOcrInvoice } from '../services/ocrApi';

const CONFIDENCE_COLOR = (c) => {
  if (c >= 0.9) return 'var(--noorix-accent-green)';
  if (c >= 0.7) return 'var(--noorix-accent-amber)';
  return 'var(--noorix-accent-red)';
};

const STATUS_BADGE = {
  auto:    { bg: '#dcfce7', color: 'var(--noorix-accent-green)', label: { ar: 'تلقائي', en: 'Auto' } },
  review:  { bg: '#fef3c7', color: 'var(--noorix-accent-amber)', label: { ar: 'راجع', en: 'Review' } },
  new:     { bg: '#fee2e2', color: 'var(--noorix-accent-red)', label: { ar: 'جديد', en: 'New' } },
};

export default function InvoiceUploadTab({ suppliers, items, onSaved }) {
  const { t, language } = useTranslation();
  const [dragging, setDragging]   = useState(false);
  const [preview, setPreview]     = useState(null);
  const [imageBase64, setBase64]  = useState(null);
  const [mimeType, setMimeType]   = useState('image/jpeg');
  const [extracted, setExtracted]   = useState(null);
  const [editItems, setEditItems]   = useState(null); // نسخة قابلة للتعديل من الأصناف
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(false);
  const fileRef = useRef();

  // الأصناف الفعلية = التعديل إن وجد أو الأصل
  const activeItems = editItems ?? extracted?.items ?? [];

  // عدد التحذيرات الفعلية (تحذيرات الرياضيات وتحذيرات السعر فقط — لا الإجمالي)
  const warningCount = useMemo(() => {
    let n = 0;
    if (extracted?.invoiceTotalWarning) n++;
    activeItems.forEach((item) => {
      if (item.mathWarning) n++;
      if (item.priceWarning) n++;
    });
    return n;
  }, [extracted?.invoiceTotalWarning, activeItems]);

  // هل المقارنة أخذت الضريبة بعين الاعتبار؟
  const vatAdjusted = extracted?.vatAdjusted;

  // تحديث صنف واحد (تعديل إنلاين)
  const updateItem = (index, field, value) => {
    const num = parseFloat(value);
    const updated = [...activeItems];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? value : num };

    // إعادة حساب الإجمالي تلقائياً إذا تغيرت الكمية أو السعر
    const item = updated[index];
    if ((field === 'quantity' || field === 'unitPrice') && item.quantity > 0 && item.unitPrice > 0) {
      updated[index] = { ...updated[index], totalPrice: Math.round(item.quantity * item.unitPrice * 100) / 100, mathWarning: undefined };
    }
    if (field === 'totalPrice') {
      updated[index] = { ...updated[index], mathWarning: undefined };
    }
    setEditItems(updated);
  };

  // تطبيق الاقتراح التلقائي
  const applyMathSuggestion = (index) => {
    const item = activeItems[index];
    if (!item.mathWarning) return;
    const updated = [...activeItems];
    if (item.mathWarning.suggestedQuantity !== undefined) {
      updated[index] = { ...updated[index], quantity: item.mathWarning.suggestedQuantity, mathWarning: undefined };
    } else if (item.mathWarning.suggestedUnitPrice !== undefined) {
      updated[index] = { ...updated[index], unitPrice: item.mathWarning.suggestedUnitPrice, mathWarning: undefined };
    }
    setEditItems(updated);
  };

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
          const detail = res.data.errorDetail || '';
          const model = res.data.usedModel || '';
          const rawSnippet = res.data.rawText ? `\n\nGemini raw: ${res.data.rawText.substring(0, 200)}` : '';
          setError(`${t('ocrExtractFailed')} — تعذّر قراءة الفاتورة.\nModel: ${model}\n${detail}${rawSnippet}`);
        } else {
          setExtracted(res.data);
          setEditItems(null); // إعادة تعيين التعديلات عند إعادة الاستخراج
          if (res.data?.enrichError) {
            console.warn('OCR enrichment warning:', res.data.enrichError);
          }
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
      const lines = activeItems.map((item) => ({
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
        supplierId:     extracted.supplierMatch?.id || null,
        supplierName:   !extracted.supplierMatch?.id ? (extracted.supplier?.name || null) : null,
        invoiceNumber:  extracted.invoiceNumber?.value || null,
        invoiceDate:    extracted.invoiceDate?.value || null,
        subtotalAmount: extracted.subtotalAmount?.value || null,
        totalAmount:    extracted.totalAmount?.value || null,
        vatAmount:      extracted.vatAmount?.value || null,
        imageUrl:       preview || null,
        rawExtraction:  extracted,
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
          setEditItems(null);
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

  const isAr = language === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  return (
    <div className="flex flex-col gap-5" dir={dir}>

      {/* Upload zone */}
      {!preview && (
        <div
          className={`ocr-upload-zone${dragging ? ' ocr-upload-zone--active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <div className="ocr-upload-icon">↑</div>
          <div className="ocr-upload-text">{t('ocrDragDrop')}</div>
          <div className="ocr-upload-hint">{t('ocrSupportedFormats')}</div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => readFile(e.target.files[0])} />
        </div>
      )}

      {preview && (
        <div className="flex flex flex-wrap gap-[18px] items-start">
          <div className="noorix-surface-card flex-[1_1_280px] min-w-0 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-[14px]">{isAr ? 'صورة الفاتورة' : 'Invoice Image'}</span>
              <Button className="modal-close-btn w-7 h-7"
                onClick={() => { setPreview(null); setBase64(null); setExtracted(null); setError(null); setEditItems(null); }}>✕</Button>
            </div>
            <img src={preview} alt="invoice" className="w-full rounded-lg max-h-[500px] object-contain" />
            <div className="mt-3 flex gap-2 flex flex-wrap">
              {!extracted && (
                <Button onClick={handleExtract} disabled={loading} variant="primary" className="flex-1 min-w-0">
                  {loading ? t('ocrExtracting') : t('ocrExtract')}
                </Button>
              )}
              {extracted && (
                <>
                  <Button onClick={handleSave} disabled={saving || success} variant="primary" className="flex-1 min-w-0">
                    {saving ? t('ocrSaving') : success ? t('ocrSaved') : t('ocrSaveInvoice')}
                  </Button>
                  <Button onClick={handleExtract} disabled={loading} className="flex-1 min-w-0">
                    {loading ? t('ocrExtracting') : (isAr ? 'إعادة استخراج' : 'Re-extract')}
                  </Button>
                </>
              )}
            </div>
          </div>

          {extracted && (
            <div className="flex flex-col gap-[14px] flex-[1_1_280px] min-w-0">

              <div className="noorix-surface-card p-4">
                <div className="font-semibold text-[14px] mb-3">{isAr ? 'معلومات الفاتورة' : 'Invoice Info'}</div>
                <div className="grid gap-2">
                  <FieldRow label={t('ocrSupplierField')} value={extracted.supplier?.name} confidence={extracted.supplier?.confidence} match={extracted.supplierMatch} />
                  <FieldRow label={t('ocrVatNumber')} value={extracted.vatNumber?.value} confidence={extracted.vatNumber?.confidence} />
                  <FieldRow label={t('ocrInvoiceNumber')} value={extracted.invoiceNumber?.value} confidence={extracted.invoiceNumber?.confidence} />
                  <FieldRow label={t('ocrInvoiceDate')} value={extracted.invoiceDate?.value} confidence={extracted.invoiceDate?.confidence} />
                </div>

                {(extracted.subtotalAmount?.value || extracted.vatAmount?.value || extracted.totalAmount?.value) && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-noorix-border">
                    {extracted.subtotalAmount?.value && (
                      <div className="flex items-center justify-between bg-noorix-bg-muted border-b border-noorix-border py-2 px-3">
                        <span className="text-[13px] text-noorix-muted">{isAr ? 'المجموع قبل الضريبة' : 'Subtotal'}</span>
                        <span className="text-[13px] font-semibold">{extracted.subtotalAmount.value.toLocaleString('en-US')} {isAr ? 'ريال' : 'SAR'}</span>
                      </div>
                    )}
                    {extracted.vatAmount?.value && (
                      <div className="flex items-center justify-between border-b border-noorix-border py-2 px-3">
                        <span className="text-[13px] text-noorix-muted">{isAr ? 'ضريبة القيمة المضافة' : 'VAT (15%)'}</span>
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--noorix-accent-amber)' }}>{extracted.vatAmount.value.toLocaleString('en-US')} {isAr ? 'ريال' : 'SAR'}</span>
                      </div>
                    )}
                    {extracted.totalAmount?.value && (
                      <div className="flex items-center justify-between bg-noorix-bg-muted py-[10px] px-3">
                        <span className="text-[13px] font-bold">{isAr ? 'الإجمالي شامل الضريبة' : 'Total (inc. VAT)'}</span>
                        <span className="text-[13px] font-bold">{extracted.totalAmount.value.toLocaleString('en-US')} {isAr ? 'ريال' : 'SAR'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {warningCount > 0 && (
                <div className="flex items-center gap-8 text-[13px] rounded-lg py-[10px] px-[14px]" style={{
                  background: 'var(--noorix-yellow-8)',
                  border: '1px solid var(--noorix-yellow-25)',
                }}>
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--noorix-accent-amber)' }}>
                      {warningCount} {isAr ? 'تحذير — راجع الأرقام قبل الحفظ' : 'warning(s) — review before saving'}
                    </div>
                    {extracted.invoiceTotalWarning && (
                      <div className="text-[12px] mt-[2px]" style={{ color: 'var(--noorix-accent-amber)' }}>{extracted.invoiceTotalWarning}</div>
                    )}
                  </div>
                </div>
              )}

              {activeItems.length > 0 && (
                <div className="noorix-surface-card p-4">
                  <div className="font-semibold text-[14px] mb-3">
                    {t('ocrItems')} ({activeItems.length})
                  </div>
                  <div className="flex flex-col gap-2">
                    {activeItems.map((item, i) => (
                      <ItemRow
                        key={i}
                        item={item}
                        index={i}
                        language={language}
                        t={t}
                        onUpdate={updateItem}
                        onApplySuggestion={applyMathSuggestion}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-[13px] rounded-lg py-3 px-4" style={{ background: 'var(--noorix-red-6)', border: '1px solid var(--noorix-red-15)', color: 'var(--noorix-accent-red)' }}>
          {error}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, confidence, match }) {
  return (
    <div className="flex gap-2 border-b border-noorix-border items-start py-1.5">
      <span className="text-[13px] text-noorix-muted min-w-[100px]">{label}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[14px] font-semibold text-noorix-text">{value || '—'}</span>
        {match && (
          <div className="text-[11px] mt-[2px]">
            <span className="py-px px-1.5 rounded" style={{
              background: match.status === 'auto' ? '#dcfce7' : '#fef3c7',
              color: match.status === 'auto' ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-amber)',
            }}>
              ↳ {match.nameAr} ({Math.round(match.score * 100)}%)
            </span>
          </div>
        )}
      </div>
      {confidence !== undefined && (
        <span className="text-[11px] font-bold" style={{ color: CONFIDENCE_COLOR(confidence) }}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  );
}

// ── حقل رقمي قابل للتعديل ────────────────────────────────────────────────────
function EditableNumber({ value, onChange, warn }) {
  return (
    <Input
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      step="any"
      className="w-[72px] py-[3px] px-1.5 rounded-md text-[13px] font-bold text-center"
      style={{
        border: `1px solid ${warn ? 'var(--color-noorix-amber)' : 'var(--noorix-border)'}`,
        background: warn ? 'var(--noorix-yellow-8)' : 'var(--noorix-bg-surface)',
        color: 'var(--noorix-text)', outline: 'none', fontFamily: 'inherit',
      }}
    />
  );
}

function ItemRow({ item, index, language, t, onUpdate, onApplySuggestion }) {
  const match = item.itemMatch;
  const statusInfo = match ? STATUS_BADGE[match.status] : STATUS_BADGE.new;
  const hasMathWarn = !!item.mathWarning;
  const hasPriceWarn = !!item.priceWarning;

  const displayName = [item.nameAr, item.nameEn].filter(Boolean).join(' / ') || item.name || '—';
  const sizeLabel = item.size ? `${item.size}${item.sizeUnit || ''}` : null;

  return (
    <div className="py-[10px] px-3 rounded-[10px]" style={{
      background: hasMathWarn ? 'var(--noorix-yellow-6)' : 'var(--noorix-bg-surface)',
      border: `1px solid ${hasMathWarn ? 'var(--noorix-yellow-40)' : 'var(--noorix-border)'}`,
    }}>
      {/* رأس الصنف */}
      <div className="flex gap-2 flex flex-wrap mb-2 justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[14px]">{displayName}</div>
          {sizeLabel && (
            <span className="text-[11px] font-semibold bg-noorix-bg-muted text-noorix-muted inline-block mt-[3px] py-px px-2 rounded">
              {sizeLabel}
            </span>
          )}
          {item.name && item.name !== displayName && (
            <div className="text-[11px] text-noorix-muted mt-[2px]">OCR: {item.name}</div>
          )}
          {match && (
            <div className="text-[11px] text-noorix-muted mt-[2px]">
              ↳ {match.nameAr}{match.nameEn ? ` / ${match.nameEn}` : ''}
              {match.hasSizes && <span className="ms-1" style={{ color: 'var(--noorix-accent-violet)' }}>• متعدد الأحجام</span>}
            </div>
          )}
        </div>
        <span className="text-[11px] font-bold py-[3px] px-2 rounded-md shrink-0" style={{
          background: statusInfo.bg, color: statusInfo.color,
        }}>
          {language === 'ar' ? statusInfo.label.ar : statusInfo.label.en}
        </span>
      </div>

      {/* حقول الكمية والسعر والإجمالي — قابلة للتعديل */}
      <div className="flex items-center gap-10 flex-wrap">
        <div className="flex flex-col items-center gap-[2px]">
          <span className="text-noorix-muted text-[10px]">الكمية</span>
          <EditableNumber value={item.quantity} warn={hasMathWarn} onChange={(v) => onUpdate(index, 'quantity', v)} />
        </div>
        <span className="text-noorix-muted text-[13px] self-end mb-1">×</span>
        <div className="flex flex-col items-center gap-[2px]">
          <span className="text-noorix-muted text-[10px]">السعر</span>
          <EditableNumber value={item.unitPrice} warn={hasMathWarn} onChange={(v) => onUpdate(index, 'unitPrice', v)} />
        </div>
        <span className="text-noorix-muted text-[13px] self-end mb-1">=</span>
        <div className="flex flex-col items-center gap-[2px]">
          <span className="text-noorix-muted text-[10px]">الإجمالي</span>
          <EditableNumber value={item.totalPrice} warn={hasMathWarn} onChange={(v) => onUpdate(index, 'totalPrice', v)} />
        </div>
        {item.confidence != null && (
          <span className="text-[11px] self-end mb-1" style={{ color: CONFIDENCE_COLOR(item.confidence) }}>
            {Math.round(item.confidence * 100)}%
          </span>
        )}
      </div>

      {/* تحذير رياضي */}
      {hasMathWarn && (
        <div className="flex items-center justify-between gap-2 mt-2 rounded-lg py-1.5 px-[10px]" style={{
          background: 'var(--noorix-yellow-12)', border: '1px solid var(--noorix-yellow-30)',
        }}>
          <div className="text-[12px]" style={{ color: 'var(--noorix-accent-amber)' }}>
            {item.mathWarning.message}
          </div>
          {(item.mathWarning.suggestedQuantity !== undefined || item.mathWarning.suggestedUnitPrice !== undefined) && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onApplySuggestion(index)}
              className="whitespace-nowrap shrink-0"
            >
              تصحيح تلقائي
            </Button>
          )}
        </div>
      )}

      {/* تحذير السعر */}
      {hasPriceWarn && (
        <div className="text-[12px] rounded-lg mt-1.5 py-1.5 px-[10px]" style={{
          background: 'var(--noorix-blue-8)', border: '1px solid var(--noorix-blue-25)',
          color: 'var(--noorix-accent-blue)',
        }}>
          السعر المعتاد في آخر 90 يوم: <strong>{item.priceWarning.avg} ريال</strong> — انحراف {item.priceWarning.deviation}%
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { Button, ScreenShell } from '../../ui';
import { submitOcrSubmission } from './services/ocrApi';
import { compressImageFileToJpegDataUrl } from '../../utils/imageUtils';

/**
 * شاشة الكاشير — رفع صورة فاتورة مورد للاستخراج في الخلفية (بدون انتظار Gemini).
 */
export default function OcrCashierSubmitScreen() {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const isAr = lang === 'ar';
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [imageBase64, setImageBase64] = useState<any>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [sentId, setSentId] = useState<any>(null);

  const readFile = useCallback((file: any) => {
    if (!file || !file.type.startsWith('image/')) return;
    void compressImageFileToJpegDataUrl(file, { maxDim: 1600, quality: 0.82 })
      .then((compressed: any) => {
        setPreview(compressed);
        setImageBase64(String(compressed).split(',')[1]);
        setMimeType('image/jpeg');
        setError(null);
        setSentId(null);
      })
      .catch((err: any) => setError(err?.message || 'تعذّر قراءة الصورة'));
  }, []);

  const handleSubmit = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setError(null);
    try {
      const res = await submitOcrSubmission(imageBase64, mimeType);
      if (res.success && res.data?.id) {
        setSentId(res.data.id);
        setPreview(null);
        setImageBase64(null);
      } else {
        setError(res.error || (isAr ? 'فشل الإرسال' : 'Send failed'));
      }
    } catch (e: any) {
      setError(e?.message || (isAr ? 'فشل الإرسال' : 'Send failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell>
      {!activeCompanyId && (
        <div className="mb-3 rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2 text-[13px] text-noorix-muted">
          {isAr ? 'اختر شركة من القائمة لإرسال فاتورة لهذا الفرع.' : 'Select a company from the menu to submit an invoice for that branch.'}
        </div>
      )}

      <div className="max-w-lg mx-auto flex flex-col gap-4" dir={isAr ? 'rtl' : 'ltr'}>
        <div>
          <h1 className="text-lg font-bold text-noorix-text m-0">
            {t('ocrCashierPageTitle')}
          </h1>
          <p className="text-[13px] text-noorix-muted m-0 mt-1">
            {t('ocrCashierPageHint')}
          </p>
        </div>

        {sentId && (
          <div className="rounded-lg border border-noorix-accent-green/40 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-[13px] text-noorix-text">
            {t('ocrCashierSentOk', sentId)}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-noorix-red/40 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-[13px] text-noorix-red whitespace-pre-wrap">
            {error}
          </div>
        )}

        {!preview && (
          <button
            type="button"
            className="ocr-upload-zone border-2 border-dashed border-noorix-border rounded-xl p-8 text-center cursor-pointer bg-noorix-bg-muted/50 hover:border-noorix-blue disabled:opacity-50"
            onClick={() => { fileRef.current?.click(); }}
            disabled={!activeCompanyId}
          >
            <div className="text-noorix-muted text-[13px]">{t('ocrDragDrop')}</div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e: any) => readFile(e.target.files?.[0])} />
          </button>
        )}

        {preview && (
          <div className="noorix-surface-card p-4 flex flex-col gap-3">
            <img src={preview} alt="" className="w-full rounded-lg max-h-[420px] object-contain" />
            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" type="button" onClick={() => { setPreview(null); setImageBase64(null); setSentId(null); }}>
                {t('ocrCancel')}
              </Button>
              <Button variant="primary" type="button" disabled={loading || !activeCompanyId} onClick={handleSubmit}>
                {loading ? (isAr ? 'جاري الإرسال…' : 'Sending…') : (isAr ? 'إرسال للاستخراج' : 'Send for extraction')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ScreenShell>
  );
}

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getOcrReviewQueue } from '../services/ocrApi';
import OcrInvoiceThumb from './OcrInvoiceThumb';

const STATUS_LABEL = {
  queued: { ar: 'في الانتظار', en: 'Queued' },
  extracting: { ar: 'جاري الاستخراج', en: 'Extracting' },
  pending_review: { ar: 'بانتظار المراجعة', en: 'Pending review' },
  extraction_failed: { ar: 'فشل الاستخراج', en: 'Extraction failed' },
};

export default function OcrReviewQueueTab({ onOpenInvoice }: any) {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';
  const { activeCompanyId } = useApp();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ocr-review-queue', activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const r = await getOcrReviewQueue();
      return r.success ? (r.data || []) : [];
    },
    refetchInterval: (query: any) => {
      const rows = query.state.data;
      if (!Array.isArray(rows)) return 8000;
      const busy = rows.some((x: any) => x.status === 'queued' || x.status === 'extracting');
      return busy ? 4000 : 12000;
    },
  });

  const rows = useMemo(() => data || [], [data]);

  return (
    <div className="flex flex-col gap-3" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-[15px] font-bold text-noorix-text m-0">
          {t('ocrReviewQueueTab')}
        </h2>
        <button
          type="button"
          className="text-[12px] font-medium text-noorix-blue underline"
          onClick={() => refetch()}
        >
          {t('ocrRefresh')}
        </button>
      </div>

      {isLoading && <div className="text-noorix-muted text-[13px]">{t('ocrQueueLoading')}</div>}

      {!isLoading && rows.length === 0 && (
        <div className="text-noorix-muted text-[13px]">{t('ocrQueueEmpty')}</div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto border border-noorix-border rounded-lg">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-noorix-bg-muted border-b border-noorix-border">
                <th className="p-2 text-start font-bold border-b border-noorix-border">{isAr ? 'صورة' : 'Image'}</th>
                <th className="p-2 text-start font-bold border-b border-noorix-border">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="p-2 text-start font-bold border-b border-noorix-border">{isAr ? 'المورد' : 'Supplier'}</th>
                <th className="p-2 text-start font-bold border-b border-noorix-border">{isAr ? 'المرسل' : 'Submitted by'}</th>
                <th className="p-2 text-start font-bold border-b border-noorix-border">{isAr ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv: any) => (
                <tr key={inv.id} className="border-b border-noorix-border last:border-b-0">
                  <td className="p-2 w-20">
                    <OcrInvoiceThumb invoiceId={inv.id} className="w-16 h-16" />
                  </td>
                  <td className="p-2">
                    {((STATUS_LABEL as Record<string, { ar: string; en: string }>)[String(inv.status)] || { ar: inv.status, en: inv.status })[isAr ? 'ar' : 'en']}
                    {inv.extractionError && (
                      <div className="text-noorix-red text-[11px] mt-1 max-w-[240px] truncate" title={inv.extractionError}>
                        {inv.extractionError}
                      </div>
                    )}
                  </td>
                  <td className="p-2">{inv.supplier?.nameAr || '—'}</td>
                  <td className="p-2">{inv.submittedBy?.nameAr || inv.submittedBy?.email || '—'}</td>
                  <td className="p-2">
                    {inv.status === 'pending_review' && (
                      <button
                        type="button"
                        className="text-noorix-blue font-medium underline text-[12px]"
                        onClick={() => onOpenInvoice?.(inv)}
                      >
                        {t('ocrReviewAction')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

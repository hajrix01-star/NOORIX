import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { getOcrReviewQueue, retryOcrInvoiceExtraction } from '../services/ocrApi';
import { ocrKeys } from '../../../services/queryKeys';
import { AdaptiveSheet, Button } from '../../../ui';
import OcrInvoiceThumb from './OcrInvoiceThumb';
import InvoiceUploadTab from './InvoiceUploadTab';
import { ocrSubmitterLabel } from '../utils/ocrSubmitterLabel';

const STATUS_LABEL = {
  queued: { ar: 'في الانتظار', en: 'Queued' },
  extracting: { ar: 'جاري الاستخراج', en: 'Extracting' },
  pending_review: { ar: 'بانتظار المراجعة', en: 'Pending review' },
  extraction_failed: { ar: 'فشل الاستخراج', en: 'Extraction failed' },
};

const OPENABLE_STATUSES = new Set(['queued', 'extracting', 'pending_review', 'extraction_failed']);

export default function OcrReviewQueueTab({
  suppliers = [],
  items = [],
  onReviewSaved,
}: {
  suppliers?: any[];
  items?: any[];
  onReviewSaved?: () => void;
}) {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';
  const { activeCompanyId } = useApp();
  const queryClient = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [reviewInvoiceId, setReviewInvoiceId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ocrKeys.reviewQueue(activeCompanyId || ''),
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

  const openInvoiceSheet = (id: string) => {
    if (!id) return;
    setReviewInvoiceId(String(id));
  };

  const handleRetry = async (id: string) => {
    if (!id || retryingId) return;
    setRetryingId(id);
    setRetryError(null);
    try {
      const r = await retryOcrInvoiceExtraction(id);
      if (!r.success) {
        setRetryError(r.error || t('ocrRetryFailed'));
      } else {
        openInvoiceSheet(id);
      }
      await refetch();
    } catch {
      setRetryError(t('ocrRetryFailed'));
    } finally {
      setRetryingId(null);
    }
  };

  const closeReviewSheet = () => {
    setReviewInvoiceId(null);
  };

  const handleReviewSaved = () => {
    closeReviewSheet();
    void refetch();
    queryClient.invalidateQueries({ queryKey: ocrKeys.invoices(activeCompanyId || '') });
    onReviewSaved?.();
  };

  const activeRow = rows.find((x: any) => String(x.id) === String(reviewInvoiceId));
  const sheetTitle =
    activeRow?.status === 'pending_review'
      ? t('ocrReviewSheetTitle')
      : t('ocrReviewProgressSheetTitle');

  return (
    <div className="flex flex-col gap-3" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-[15px] font-bold text-noorix-text m-0">
          {t('ocrReviewQueueTab')}
        </h2>
        <Button type="button" variant="raw" size="sm" className="text-noorix-blue underline" onClick={() => refetch()}>
          {t('ocrRefresh')}
        </Button>
      </div>

      {isLoading && <div className="text-noorix-muted text-[13px]">{t('ocrQueueLoading')}</div>}
      {retryError && (
        <div className="text-[13px] rounded-lg border border-noorix-red/35 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-noorix-red">
          {retryError}
        </div>
      )}

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
              {rows.map((inv: any) => {
                const status = String(inv.status || '');
                const canOpen = OPENABLE_STATUSES.has(status);
                const submitterName = ocrSubmitterLabel(inv.submittedBy, isAr) || '—';
                const statusLabel =
                  ((STATUS_LABEL as Record<string, { ar: string; en: string }>)[status] || {
                    ar: status,
                    en: status,
                  })[isAr ? 'ar' : 'en'];

                return (
                  <tr key={inv.id} className="border-b border-noorix-border last:border-b-0">
                    <td className="p-2 w-24">
                      {canOpen ? (
                        <button
                          type="button"
                          className="cursor-pointer rounded-md border-0 bg-transparent p-0 hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-noorix-blue"
                          onClick={() => openInvoiceSheet(inv.id)}
                          title={statusLabel}
                          aria-label={statusLabel}
                        >
                          <OcrInvoiceThumb
                            invoiceId={inv.id}
                            className="w-16 h-16"
                            submitterLabel={submitterName === '—' ? '' : submitterName}
                          />
                        </button>
                      ) : (
                        <OcrInvoiceThumb
                          invoiceId={inv.id}
                          className="w-16 h-16"
                          submitterLabel={submitterName === '—' ? '' : submitterName}
                        />
                      )}
                    </td>
                    <td className="p-2">
                      {canOpen ? (
                        <button
                          type="button"
                          className="cursor-pointer border-0 bg-transparent p-0 text-start text-noorix-blue underline hover:opacity-85"
                          onClick={() => openInvoiceSheet(inv.id)}
                        >
                          {statusLabel}
                        </button>
                      ) : (
                        statusLabel
                      )}
                      {inv.extractionError && (
                        <div
                          className="text-noorix-red text-[11px] mt-1 max-w-[240px] truncate"
                          title={inv.extractionError}
                        >
                          {inv.extractionError}
                        </div>
                      )}
                    </td>
                    <td className="p-2">{inv.supplier?.nameAr || '—'}</td>
                    <td className="p-2">{submitterName}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {canOpen && status !== 'pending_review' && (
                          <Button
                            type="button"
                            variant="raw"
                            size="sm"
                            className="text-noorix-blue underline"
                            onClick={() => openInvoiceSheet(inv.id)}
                          >
                            {t('ocrViewProgress')}
                          </Button>
                        )}
                        {status === 'pending_review' && (
                          <Button
                            type="button"
                            variant="raw"
                            size="sm"
                            className="text-noorix-blue underline"
                            onClick={() => openInvoiceSheet(inv.id)}
                          >
                            {t('ocrReviewAction')}
                          </Button>
                        )}
                        {status === 'extraction_failed' && (
                          <Button
                            type="button"
                            variant="raw"
                            size="sm"
                            className="text-noorix-blue underline"
                            onClick={() => handleRetry(inv.id)}
                            disabled={retryingId === inv.id}
                          >
                            {retryingId === inv.id ? t('ocrRetrying') : t('ocrRetryExtraction')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdaptiveSheet
        open={!!reviewInvoiceId}
        onClose={closeReviewSheet}
        title={sheetTitle}
        size="full"
      >
        {reviewInvoiceId && (
          <InvoiceUploadTab
            workflowMode="review"
            prefillInvoiceId={reviewInvoiceId}
            onPrefillConsumed={() => {}}
            onDismiss={closeReviewSheet}
            onSaved={handleReviewSaved}
            suppliers={suppliers}
            items={items}
          />
        )}
      </AdaptiveSheet>
    </div>
  );
}

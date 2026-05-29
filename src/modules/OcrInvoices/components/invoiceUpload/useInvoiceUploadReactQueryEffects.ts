import { useEffect, type MutableRefObject } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { getSaudiToday } from '../../../../utils/saudiDate';
import { getOcrInvoice } from '../../services/ocrApi';
import { ocrKeys } from '../../../../services/queryKeys';
import { ocrInvoiceImageQueryKey, fetchOcrInvoiceImageBlob } from '../../ocrInvoiceImageQuery';
import { revokePreviewUrl } from './ocrInvoiceUploadUtils';
import { isOcrReviewInProgress, type OcrReviewInvoiceStatus } from './ocrReviewInvoiceStatus';

/** يعيد وضع «لم يمس المستخدم اختيار المورد» عند تغيّر مفتاح اقتراحات المحاسبة */
export function useResetAccountingUserTouchOnSuggestKey(
  accSuggestKey: string,
  userTouchedAccountingRef: MutableRefObject<boolean>,
) {
  useEffect(() => {
    userTouchedAccountingRef.current = false;
  }, [accSuggestKey, userTouchedAccountingRef]);
}

export function useAutoPickTopAccountingSupplier({
  accSuggestions,
  accSuggestKey,
  finalizeOcrId,
  canCreatePurchase,
  invoiceVatDigits,
  userTouchedAccountingRef,
  setAccountingSupplierId,
}: {
  accSuggestions: any[];
  accSuggestKey: string;
  finalizeOcrId: any;
  canCreatePurchase: boolean;
  invoiceVatDigits: string;
  userTouchedAccountingRef: MutableRefObject<boolean>;
  setAccountingSupplierId: (id: string) => void;
}) {
  useEffect(() => {
    if (userTouchedAccountingRef.current) return;
    if (!finalizeOcrId || !canCreatePurchase) return;
    const top = accSuggestions[0];
    if (!top?.id) return;
    const topTax = String(top.taxNumber || '').replace(/\D/g, '');
    const vatMatch = invoiceVatDigits.length >= 9 && topTax === invoiceVatDigits;
    const ms = top.matchScore ?? 0;
    const secondMs = accSuggestions[1]?.matchScore ?? 0;
    const pick =
      !!top.linkedFromOcr ||
      vatMatch ||
      ms >= 100 ||
      (ms >= 72 && accSuggestions.length === 1) ||
      (ms >= 80 && ms >= secondMs + 20);
    if (pick) setAccountingSupplierId(top.id);
  }, [accSuggestions, accSuggestKey, finalizeOcrId, canCreatePurchase, invoiceVatDigits, setAccountingSupplierId, userTouchedAccountingRef]);
}

function applyReviewInvoiceSnapshot(
  inv: any,
  prefillInvoiceId: string,
  language: string,
  t: (k: string) => string,
  {
    setError,
    setExtracted,
    setEditItems,
    setFinalizeOcrId,
    setPrefillLinkedPurchase,
    setPrefillOcrSupplierId,
    setPurchaseSupplierInvoiceNumber,
    setTransactionDate,
    setCreateLinkedPurchase,
    setAccountingSupplierId,
    setVaultId,
    setReviewInvoiceStatus,
    setLoading,
    setExtractStartedAt,
    setExtractFailureStage,
    setPrefillSubmittedBy,
  }: {
    setError: (e: any) => void;
    setExtracted: (v: any) => void;
    setEditItems: (v: any) => void;
    setFinalizeOcrId: (v: any) => void;
    setPrefillLinkedPurchase: (v: any) => void;
    setPrefillOcrSupplierId: (v: any) => void;
    setPurchaseSupplierInvoiceNumber: (s: string) => void;
    setTransactionDate: (s: string) => void;
    setCreateLinkedPurchase: (v: boolean) => void;
    setAccountingSupplierId: (s: string) => void;
    setVaultId: (s: string) => void;
    setReviewInvoiceStatus: (s: OcrReviewInvoiceStatus | null) => void;
    setLoading: (b: boolean) => void;
    setExtractStartedAt: (fn: (prev: number | null) => number | null) => void;
    setExtractFailureStage: (s: 'request' | 'parse' | null) => void;
    setPrefillSubmittedBy: (v: any) => void;
  },
) {
  const status = String(inv.status || '') as OcrReviewInvoiceStatus;
  const raw = inv.rawExtraction;

  setFinalizeOcrId(prefillInvoiceId);
  setPrefillSubmittedBy(inv.submittedBy || null);
  setPrefillLinkedPurchase(inv.linkedPurchaseInvoice?.id ? inv.linkedPurchaseInvoice : null);
  setPrefillOcrSupplierId(inv.supplierId || null);
  setPurchaseSupplierInvoiceNumber(String(inv.invoiceNumber || raw?.invoiceNumber?.value || '').trim());
  setTransactionDate(getSaudiToday());
  setCreateLinkedPurchase(false);
  setAccountingSupplierId('');
  setVaultId('');
  setReviewInvoiceStatus(status || null);

  if (raw && typeof raw === 'object') {
    setExtracted(raw);
    setEditItems(null);
    setError(null);
    setExtractFailureStage(null);
    if (status === 'pending_review') {
      setLoading(false);
      setExtractStartedAt(() => null);
    }
  } else {
    setExtracted(null);
    setEditItems(null);
  }

  if (status === 'queued') {
    setLoading(false);
    setExtractStartedAt(() => null);
    setExtractFailureStage(null);
    setError(null);
  } else if (status === 'extracting') {
    setLoading(true);
    setExtractStartedAt((prev) => prev ?? Date.now());
    setExtractFailureStage(null);
    setError(null);
  } else if (status === 'extraction_failed') {
    setLoading(false);
    setExtractStartedAt(() => null);
    setExtractFailureStage('request');
    setError(String(inv.extractionError || t('ocrRetryFailed')));
  } else if (status === 'pending_review' && !(raw && typeof raw === 'object')) {
    setLoading(false);
    setError(
      language === 'ar'
        ? 'لا توجد بيانات استخراج محفوظة لهذه الفاتورة.'
        : 'No saved extraction for this invoice.',
    );
  }
}

export function usePrefillOcrInvoiceFromId({
  prefillInvoiceId,
  onPrefillConsumed,
  language,
  activeCompanyId,
  queryClient,
  t,
  setError,
  setExtracted,
  setEditItems,
  setFinalizeOcrId,
  setPrefillLinkedPurchase,
  setPrefillOcrSupplierId,
  setPurchaseSupplierInvoiceNumber,
  setTransactionDate,
  setCreateLinkedPurchase,
  setAccountingSupplierId,
  setVaultId,
  setPreview,
  setBase64,
  setMimeType,
  setPrefillLoading,
  setPrefillSubmittedBy,
  setReviewInvoiceStatus,
  setLoading,
  setExtractStartedAt,
  setExtractFailureStage,
}: {
  prefillInvoiceId: any;
  onPrefillConsumed?: () => void;
  language: string;
  activeCompanyId: any;
  queryClient: QueryClient;
  t: (k: string) => string;
  setError: (e: any) => void;
  setExtracted: (v: any) => void;
  setEditItems: (v: any) => void;
  setFinalizeOcrId: (v: any) => void;
  setPrefillLinkedPurchase: (v: any) => void;
  setPrefillOcrSupplierId: (v: any) => void;
  setPurchaseSupplierInvoiceNumber: (s: string) => void;
  setTransactionDate: (s: string) => void;
  setCreateLinkedPurchase: (v: boolean) => void;
  setAccountingSupplierId: (s: string) => void;
  setVaultId: (s: string) => void;
  setPreview: (fn: (prev: any) => any) => void;
  setBase64: (v: any) => void;
  setMimeType: (m: string) => void;
  setPrefillLoading: (b: boolean) => void;
  setPrefillSubmittedBy: (v: any) => void;
  setReviewInvoiceStatus: (s: OcrReviewInvoiceStatus | null) => void;
  setLoading: (b: boolean) => void;
  setExtractStartedAt: (fn: (prev: number | null) => number | null) => void;
  setExtractFailureStage: (s: 'request' | 'parse' | null) => void;
}) {
  useEffect(() => {
    if (!prefillInvoiceId) return;
    let cancelled = false;
    setPrefillLoading(true);
    setError(null);
    const snapshotSetters = {
      setError,
      setExtracted,
      setEditItems,
      setFinalizeOcrId,
      setPrefillLinkedPurchase,
      setPrefillOcrSupplierId,
      setPurchaseSupplierInvoiceNumber,
      setTransactionDate,
      setCreateLinkedPurchase,
      setAccountingSupplierId,
      setVaultId,
      setReviewInvoiceStatus,
      setLoading,
      setExtractStartedAt,
      setExtractFailureStage,
      setPrefillSubmittedBy,
    };
    (async () => {
      try {
        const r = await getOcrInvoice(prefillInvoiceId);
        if (cancelled) return;
        if (!r.success || !r.data) {
          setError(r.error || t('ocrExtractFailed'));
          onPrefillConsumed?.();
          return;
        }
        applyReviewInvoiceSnapshot(r.data, prefillInvoiceId, language, t, snapshotSetters);
        if (cancelled) return;
        try {
          const blob = await queryClient.ensureQueryData({
            queryKey: ocrInvoiceImageQueryKey(activeCompanyId, prefillInvoiceId),
            queryFn: ({ signal }: any) => fetchOcrInvoiceImageBlob(prefillInvoiceId, signal),
            staleTime: 5 * 60 * 1000,
          });
          if (cancelled) return;
          setPreview((prev: any) => {
            revokePreviewUrl(prev);
            return URL.createObjectURL(blob);
          });
          setMimeType(blob.type || 'image/jpeg');
        } catch {
          /* optional image */
        }
        setBase64(null);
      } catch {
        if (!cancelled) setError(t('ocrExtractFailed'));
      } finally {
        if (!cancelled) {
          setPrefillLoading(false);
          onPrefillConsumed?.();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    prefillInvoiceId,
    onPrefillConsumed,
    language,
    activeCompanyId,
    queryClient,
    t,
    setError,
    setExtracted,
    setEditItems,
    setFinalizeOcrId,
    setPrefillLinkedPurchase,
    setPrefillOcrSupplierId,
    setPurchaseSupplierInvoiceNumber,
    setTransactionDate,
    setCreateLinkedPurchase,
    setAccountingSupplierId,
    setVaultId,
    setPreview,
    setBase64,
    setMimeType,
    setPrefillLoading,
    setPrefillSubmittedBy,
    setReviewInvoiceStatus,
    setLoading,
    setExtractStartedAt,
    setExtractFailureStage,
  ]);
}

export function useReviewInvoiceProgressPolling({
  workflowMode,
  finalizeOcrId,
  reviewInvoiceStatus,
  activeCompanyId,
  queryClient,
  t,
  setError,
  setExtracted,
  setEditItems,
  setReviewInvoiceStatus,
  setLoading,
  setExtractStartedAt,
  setExtractFailureStage,
  setExtractWarning,
}: {
  workflowMode: string;
  finalizeOcrId: string | null;
  reviewInvoiceStatus: OcrReviewInvoiceStatus | null;
  activeCompanyId: string | null | undefined;
  queryClient: QueryClient;
  t: (k: string) => string;
  setError: (e: any) => void;
  setExtracted: (v: any) => void;
  setEditItems: (v: any) => void;
  setReviewInvoiceStatus: (s: OcrReviewInvoiceStatus | null) => void;
  setLoading: (b: boolean) => void;
  setExtractStartedAt: (fn: (prev: number | null) => number | null) => void;
  setExtractFailureStage: (s: 'request' | 'parse' | null) => void;
  setExtractWarning: (v: any) => void;
}) {
  useEffect(() => {
    if (workflowMode !== 'review' || !finalizeOcrId) return;
    if (!isOcrReviewInProgress(reviewInvoiceStatus)) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const r = await getOcrInvoice(finalizeOcrId);
        if (cancelled || !r.success || !r.data) return;
        const inv = r.data;
        const status = String(inv.status || '') as OcrReviewInvoiceStatus;
        setReviewInvoiceStatus(status || null);

        if (status === 'pending_review') {
          setLoading(false);
          setExtractStartedAt(() => null);
          setExtractFailureStage(null);
          setExtractWarning(null);
          if (inv.rawExtraction && typeof inv.rawExtraction === 'object') {
            setExtracted(inv.rawExtraction);
            setEditItems(null);
            setError(null);
          }
          void queryClient.invalidateQueries({ queryKey: ocrKeys.reviewQueue(activeCompanyId || '') });
          return;
        }
        if (status === 'extraction_failed') {
          setLoading(false);
          setExtractStartedAt(() => null);
          setExtractFailureStage('request');
          setError(String(inv.extractionError || t('ocrRetryFailed')));
          void queryClient.invalidateQueries({ queryKey: ocrKeys.reviewQueue(activeCompanyId || '') });
          return;
        }
        if (status === 'extracting') {
          setLoading(true);
          setExtractStartedAt((prev) => prev ?? Date.now());
          setExtractFailureStage(null);
          setError(null);
          return;
        }
        if (status === 'queued') {
          setLoading(false);
          setExtractStartedAt(() => null);
          setExtractFailureStage(null);
          setError(null);
        }
      } catch {
        /* keep polling */
      }
    };

    void poll();
    const id = window.setInterval(poll, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    workflowMode,
    finalizeOcrId,
    reviewInvoiceStatus,
    activeCompanyId,
    queryClient,
    t,
    setError,
    setExtracted,
    setEditItems,
    setReviewInvoiceStatus,
    setLoading,
    setExtractStartedAt,
    setExtractFailureStage,
    setExtractWarning,
  ]);
}

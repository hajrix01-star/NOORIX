import { useEffect, type MutableRefObject } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { getSaudiToday } from '../../../../utils/saudiDate';
import { getOcrInvoice } from '../../services/ocrApi';
import { ocrInvoiceImageQueryKey, fetchOcrInvoiceImageBlob } from '../../ocrInvoiceImageQuery';
import { revokePreviewUrl } from './ocrInvoiceUploadUtils';

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
}) {
  useEffect(() => {
    if (!prefillInvoiceId) return;
    let cancelled = false;
    setPrefillLoading(true);
    setError(null);
    (async () => {
      try {
        const r = await getOcrInvoice(prefillInvoiceId);
        if (cancelled) return;
        if (!r.success || !r.data) {
          setError(r.error || t('ocrExtractFailed'));
          onPrefillConsumed?.();
          return;
        }
        const inv = r.data;
        const raw = inv.rawExtraction;
        if (raw && typeof raw === 'object') {
          setExtracted(raw);
          setEditItems(null);
        } else {
          setError(
            language === 'ar'
              ? 'لا توجد بيانات استخراج محفوظة لهذه الفاتورة.'
              : 'No saved extraction for this invoice.',
          );
          onPrefillConsumed?.();
          return;
        }
        setFinalizeOcrId(prefillInvoiceId);
        setPrefillLinkedPurchase(inv.linkedPurchaseInvoice?.id ? inv.linkedPurchaseInvoice : null);
        setPrefillOcrSupplierId(inv.supplierId || null);
        setPurchaseSupplierInvoiceNumber(String(inv.invoiceNumber || raw?.invoiceNumber?.value || '').trim());
        setTransactionDate(getSaudiToday());
        setCreateLinkedPurchase(false);
        setAccountingSupplierId('');
        setVaultId('');
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
  }, [prefillInvoiceId, onPrefillConsumed, language, activeCompanyId, queryClient]);
}

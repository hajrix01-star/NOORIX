import { useQuery } from '@tanstack/react-query';
import { useApp } from '../../../context/AppContext';
import { fetchOcrInvoiceImageBlob, ocrInvoiceImageQueryKey } from '../ocrInvoiceImageQuery';

/**
 * جلب صورة فاتورة OCR مع كاش React Query — نفس المفتاح يُستخدم في InvoiceUploadTab عبر ensureQueryData.
 */
export function useOcrInvoiceImageBlob(invoiceId, enabled = true) {
  const { activeCompanyId } = useApp();
  return useQuery({
    queryKey: ocrInvoiceImageQueryKey(activeCompanyId, invoiceId),
    queryFn: ({ signal }) => fetchOcrInvoiceImageBlob(invoiceId, signal),
    enabled: Boolean(invoiceId && activeCompanyId && enabled),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: (failureCount, err) => (err?.status === 429 ? false : failureCount < 1),
    refetchOnWindowFocus: false,
  });
}

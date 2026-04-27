import { useCallback } from 'react';
import { getSaudiToday } from '../../../../utils/saudiDate';
import { compressImageFileToJpegDataUrl } from '../../../../utils/imageUtils';
import { revokePreviewUrl } from './ocrInvoiceUploadUtils';

type SetState<T> = (v: T | ((p: T) => T)) => void;

/**
 * قراءة صورة للرفع: ضغط، إعادة تعيين سياق المشتري، معاودة تاريخ العملية لليوم.
 */
export function useOcrInvoiceImagePipeline(
  setPreview: SetState<any>,
  setBase64: (v: any) => void,
  setMimeType: (m: string) => void,
  setExtracted: (v: any) => void,
  setFinalizeOcrId: (v: any) => void,
  setPrefillLinkedPurchase: (v: any) => void,
  setPostSaveLinkedPurchase: (v: any) => void,
  setPrefillOcrSupplierId: (v: any) => void,
  setCreateLinkedPurchase: (v: boolean) => void,
  setAccountingSupplierId: (s: string) => void,
  setVaultId: (s: string) => void,
  setPurchaseSupplierInvoiceNumber: (s: string) => void,
  setTransactionDate: (s: string) => void,
  setError: (e: any) => void,
  setSuccess: (b: boolean) => void,
) {
  const readFile = useCallback(
    (file: any) => {
      if (!file || !file.type.startsWith('image/')) return;
      void compressImageFileToJpegDataUrl(file, { maxDim: 1600, quality: 0.82 })
        .then((compressed: any) => {
          setPreview((prev: any) => {
            revokePreviewUrl(prev);
            return compressed;
          });
          setBase64(String(compressed).split(',')[1]);
          setMimeType('image/jpeg');
          setExtracted(null);
          setFinalizeOcrId(null);
          setPrefillLinkedPurchase(null);
          setPostSaveLinkedPurchase(null);
          setPrefillOcrSupplierId(null);
          setCreateLinkedPurchase(false);
          setAccountingSupplierId('');
          setVaultId('');
          setPurchaseSupplierInvoiceNumber('');
          setTransactionDate(getSaudiToday());
          setError(null);
          setSuccess(false);
        })
        .catch((err: any) => {
          setError(err?.message || 'تعذّر قراءة الصورة');
          setSuccess(false);
        });
    },
    [
      setPreview,
      setBase64,
      setMimeType,
      setExtracted,
      setFinalizeOcrId,
      setPrefillLinkedPurchase,
      setPostSaveLinkedPurchase,
      setPrefillOcrSupplierId,
      setCreateLinkedPurchase,
      setAccountingSupplierId,
      setVaultId,
      setPurchaseSupplierInvoiceNumber,
      setTransactionDate,
      setError,
      setSuccess,
    ],
  );

  return { readFile };
}

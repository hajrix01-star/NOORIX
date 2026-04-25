import React, { useEffect, useState } from 'react';
import { useOcrInvoiceImageBlob } from '../hooks/useOcrInvoiceImageBlob';

/** صورة مصغّرة مع مصادقة — جلب عبر React Query (كاش مشترك مع تبويب الرفع) */
export default function OcrInvoiceThumb({ invoiceId, className = '' }) {
  const { data: blob, isSuccess } = useOcrInvoiceImageBlob(invoiceId, true);
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    if (isSuccess && blob) {
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    } else {
      setSrc(null);
    }
    return () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          /* ignore */
        }
      }
    };
  }, [blob, isSuccess]);

  if (!src) {
    return <div className={`bg-noorix-bg-muted rounded ${className}`} style={{ minHeight: 48 }} />;
  }
  return <img src={src} alt="" className={`object-cover rounded ${className}`} />;
}

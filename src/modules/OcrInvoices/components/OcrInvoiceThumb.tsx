import React, { useEffect, useState } from 'react';
import { useOcrInvoiceImageBlob } from '../hooks/useOcrInvoiceImageBlob';

/** صورة مصغّرة مع مصادقة — جلب عبر React Query (كاش مشترك مع تبويب الرفع) */
export default function OcrInvoiceThumb({
  invoiceId,
  className = '',
  submitterLabel = '',
}: {
  invoiceId: string;
  className?: string;
  submitterLabel?: string;
}) {
  const { data: blob, isSuccess } = useOcrInvoiceImageBlob(invoiceId, true);
  const [src, setSrc] = useState<any>(null);
  const caption = String(submitterLabel || '').trim();

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

  return (
    <div className="flex flex-col gap-1 min-w-0 max-w-[96px]">
      {!src ? (
        <div className={`bg-noorix-bg-muted rounded ${className}`} style={{ minHeight: 48 }} />
      ) : (
        <img src={src} alt="" className={`object-cover rounded ${className}`} />
      )}
      {caption ? (
        <div
          className="text-[10px] font-semibold leading-tight text-noorix-text truncate"
          title={caption}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
}

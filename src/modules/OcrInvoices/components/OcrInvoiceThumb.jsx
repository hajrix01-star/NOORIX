import React, { useEffect, useState } from 'react';
import { getAuthToken, getActiveCompanyId } from '../../../services/authStore';
import { getApiBaseUrl } from '../../../services/api';

/** صورة مصغّرة مع مصادقة (img src لا يرسل Bearer) */
export default function OcrInvoiceThumb({ invoiceId, className = '' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let revoked = false;
    let objectUrl = null;
    (async () => {
      try {
        const url = new URL(`/api/v1/ocr/invoices/${encodeURIComponent(invoiceId)}/image`, getApiBaseUrl());
        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${getAuthToken() || ''}`,
            'x-company-id': String(getActiveCompanyId() || ''),
          },
        });
        if (!res.ok) return;
        const blob = await res.blob();
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoiceId]);

  if (!src) {
    return <div className={`bg-noorix-bg-muted rounded ${className}`} style={{ minHeight: 48 }} />;
  }
  return <img src={src} alt="" className={`object-cover rounded ${className}`} />;
}

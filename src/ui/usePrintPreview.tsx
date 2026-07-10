import React, { useCallback, useMemo, useState } from 'react';
import { buildPrintDocumentHtml, type PrintDocumentHtmlOptions } from '../utils/printUtils';
import PrintPreviewModal from './PrintPreviewModal';

type PrintPreviewState = {
  title: string;
  html: string;
};

type UsePrintPreviewOptions = {
  title?: string;
  closeLabel?: string;
  printLabel?: string;
  iframeTitle?: string;
};

type PrintPreviewDocumentOptions = PrintDocumentHtmlOptions & {
  previewTitle?: string;
};

export function usePrintPreview({
  title = 'معاينة الطباعة',
  closeLabel = 'إغلاق',
  printLabel = 'طباعة / حفظ PDF',
  iframeTitle,
}: UsePrintPreviewOptions = {}) {
  const [preview, setPreview] = useState<PrintPreviewState | null>(null);

  const printPreviewModal = useMemo(
    () => (
      <PrintPreviewModal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={title}
        html={preview?.html || ''}
        closeLabel={closeLabel}
        printLabel={printLabel}
        iframeTitle={preview?.title || iframeTitle || title}
      />
    ),
    [closeLabel, iframeTitle, preview, printLabel, title],
  );

  const openPrintPreview = useCallback((nextPreview: PrintPreviewState) => {
    setPreview(nextPreview);
  }, []);

  const openPrintDocumentPreview = useCallback((options: PrintPreviewDocumentOptions) => {
    const html = buildPrintDocumentHtml({ ...options, autoPrint: false });
    setPreview({
      title: options.previewTitle || options.title || title,
      html,
    });
  }, [title]);

  return {
    openPrintPreview,
    openPrintDocumentPreview,
    closePrintPreview: () => setPreview(null),
    printPreviewModal,
  };
}

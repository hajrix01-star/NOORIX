import React, { useRef, type ReactNode } from 'react';
import Button from './Button';
import Modal from './Modal';

type PrintPreviewModalProps = {
  open: boolean;
  title: string;
  html: string;
  onClose: () => void;
  printLabel?: string;
  closeLabel?: string;
  iframeTitle?: string;
  footerExtra?: ReactNode;
};

export default function PrintPreviewModal({
  open,
  title,
  html,
  onClose,
  printLabel = 'طباعة / حفظ PDF',
  closeLabel = 'إغلاق',
  iframeTitle,
  footerExtra,
}: PrintPreviewModalProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  function printFrame() {
    const frameWindow = frameRef.current?.contentWindow;
    if (!frameWindow) return;
    frameWindow.focus();
    frameWindow.print();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="full"
      closeOnBackdrop={false}
      footer={(
        <>
          <Button type="button" onClick={onClose}>
            {closeLabel}
          </Button>
          {footerExtra}
          <Button type="button" variant="primary" onClick={printFrame}>
            {printLabel}
          </Button>
        </>
      )}
    >
      <iframe
        ref={frameRef}
        title={iframeTitle || title}
        srcDoc={html}
        className="h-[72vh] w-full rounded-lg border border-noorix-border bg-white"
      />
    </Modal>
  );
}

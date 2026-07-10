import React from 'react';
import { Button, Modal } from '../../../ui';

type OrderConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function OrderConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  onClose,
  onConfirm,
}: OrderConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[14px] text-noorix-muted">{message}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? confirmLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import React from 'react';
import { Button } from '../../../../../ui';

type Props = {
  confirmTitle: string;
  previewText: string;
  submitting: boolean;
  backLabel: string;
  savingLabel: string;
  confirmLabel: string;
  onBack: () => void;
  onConfirm: () => void;
};

export function HrQuickEntrySummary({
  confirmTitle,
  previewText,
  submitting,
  backLabel,
  savingLabel,
  confirmLabel,
  onBack,
  onConfirm,
}: Props) {
  return (
    <div className="flex flex flex-col gap-5">
      <div className="text-[14px] font-semibold text-noorix-muted">{confirmTitle}</div>
      <div className="p-4 rounded-xl bg-noorix-bg-muted text-[15px] leading-[1.7] whitespace-pre-wrap">{previewText}</div>
      <div className="flex gap-3">
        <Button onClick={onBack} className="flex-1 min-h-[50px]">
          {backLabel}
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={submitting} className="flex-1 min-h-[50px] text-[15px]">
          {submitting ? savingLabel : confirmLabel}
        </Button>
      </div>
    </div>
  );
}

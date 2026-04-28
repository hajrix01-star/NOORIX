import React from 'react';
import { Button } from '../../../../../ui';

type Props = {
  cancelLabel: string;
  primaryLabel: string;
  onCancel: () => void;
  onPrimary: () => void;
  primaryDisabled: boolean;
};

export function PayrollRunActions({
  cancelLabel,
  primaryLabel,
  onCancel,
  onPrimary,
  primaryDisabled,
}: Props) {
  return (
    <div className="flex gap-2.5 flex flex-wrap">
      <Button variant="ghost" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button variant="primary" onClick={onPrimary} disabled={primaryDisabled} className="font-bold min-w-[120px]">
        {primaryLabel}
      </Button>
    </div>
  );
}

import React from 'react';
import { DialogActions } from '../../../../../ui';

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
    <DialogActions
      actions={[
        { key: 'cancel', label: cancelLabel, role: 'cancel', onClick: onCancel },
        {
          key: 'primary',
          label: primaryLabel,
          role: 'save',
          disabled: primaryDisabled,
          className: 'font-bold min-w-[120px]',
          onClick: onPrimary,
        },
      ]}
    />
  );
}

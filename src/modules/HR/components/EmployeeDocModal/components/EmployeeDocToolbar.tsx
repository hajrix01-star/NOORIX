import React from 'react';
import { DialogActions } from '../../../../../ui';
import type { EmployeeDocTFunction } from '../types';

export function EmployeeDocToolbar({
  onPrint,
  onSave,
  saving,
  t,
}: {
  onClose: () => void;
  onPrint: () => void;
  onSave: () => void;
  saving: boolean;
  t: EmployeeDocTFunction;
}) {
  return (
    <DialogActions
      actions={[
        {
          key: 'print',
          label: t('print') || 'طباعة',
          role: 'print',
          onClick: onPrint,
        },
        {
          key: 'save',
          label: saving ? t('saving') : t('saveToDocuments') || 'حفظ في المستندات',
          role: 'save',
          disabled: saving,
          onClick: onSave,
        },
      ]}
    />
  );
}

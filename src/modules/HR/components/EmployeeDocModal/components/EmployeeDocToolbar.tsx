import React from 'react';
import { Button } from '../../../../../ui';
import type { EmployeeDocTFunction } from '../types';

export function EmployeeDocToolbar({
  onClose,
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
    <>
      <Button variant="ghost" onClick={onClose}>
        {t('close')}
      </Button>
      <Button onClick={onPrint}>{t('print') || 'طباعة'}</Button>
      <Button variant="primary" disabled={saving} onClick={onSave}>
        {saving ? t('saving') : t('saveToDocuments') || 'حفظ في المستندات'}
      </Button>
    </>
  );
}

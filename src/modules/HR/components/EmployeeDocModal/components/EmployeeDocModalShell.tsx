import React, { type ReactNode } from 'react';
import { AdaptiveSheet } from '../../../../../ui';
import { EmployeeDocToolbar } from './EmployeeDocToolbar';
import type { EmployeeDocTFunction } from '../types';

export function EmployeeDocModalShell({
  title,
  children,
  onClose,
  onPrint,
  onSave,
  saving,
  t,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onPrint: () => void;
  onSave: () => void;
  saving: boolean;
  t: EmployeeDocTFunction;
}) {
  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={title}
      size="lg"
      side="start"
      className="employee-doc-preview-drawer"
      footer={
        <EmployeeDocToolbar onClose={onClose} onPrint={onPrint} onSave={onSave} saving={saving} t={t} />
      }
    >
      {children}
    </AdaptiveSheet>
  );
}

import React, { useMemo } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { useToast } from '../../../../context/ToastContext';
import { buildSalaryRows } from './utils/employeeDocBuilders';
import { useEmployeeDocPrintSave } from './hooks/useEmployeeDocPrintSave';
import type { SalaryCertificateModalProps } from './types';
import { EmployeeDocModalShell } from './components/EmployeeDocModalShell';
import { EmployeeDocPrintFrame } from './components/EmployeeDocPrintFrame';
import { EmployeeDocDocumentFrame } from './components/EmployeeDocDocumentFrame';
import { SalaryCertificatePreview } from './components/SalaryCertificatePreview';

export function SalaryCertificateModal({
  employee,
  compensationSnapshot,
  companyId,
  companyName,
  companyLogo,
  onClose,
  onSaved,
}: SalaryCertificateModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { rows, total } = useMemo(() => buildSalaryRows(compensationSnapshot), [compensationSnapshot]);

  const { printRef, saving, handlePrint, handleSaveToDocuments, printPreviewModal } = useEmployeeDocPrintSave({
    t,
    showToast,
    printTitle: t('salaryCertificate') || 'Salary Certificate',
    companyId,
    employee,
    documentType: 'certificate',
    filePrefix: 'salary-certificate',
    companyName,
    companyLogo,
    onSaved,
    onClose,
    saveFailedMessage: t('saveFailed'),
  });

  return (
    <EmployeeDocModalShell
      title={t('salaryCertificate') || 'شهادة تعريف راتب'}
      onClose={() => onClose?.()}
      onPrint={handlePrint}
      onSave={handleSaveToDocuments}
      saving={saving}
      t={t}
    >
      {printPreviewModal}
      <EmployeeDocPrintFrame printRef={printRef}>
        <EmployeeDocDocumentFrame companyName={companyName} companyLogo={companyLogo} arabicTitle="شهادة تعريف راتب" englishTitle="Employment & Salary Certificate">
          <SalaryCertificatePreview employee={employee} rows={rows} total={total} />
        </EmployeeDocDocumentFrame>
      </EmployeeDocPrintFrame>
    </EmployeeDocModalShell>
  );
}

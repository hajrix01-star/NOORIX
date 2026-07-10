import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { useToast } from '../../../../context/ToastContext';
import { toYmd } from '../../../../utils/saudiDate';
import { buildSalaryRows } from './utils/employeeDocBuilders';
import { useEmployeeDocPrintSave } from './hooks/useEmployeeDocPrintSave';
import type { ContractModalProps } from './types';
import { EmployeeDocModalShell } from './components/EmployeeDocModalShell';
import { EmployeeDocPrintFrame } from './components/EmployeeDocPrintFrame';
import { EmployeeDocDocumentFrame } from './components/EmployeeDocDocumentFrame';
import { ContractDocForm } from './components/ContractDocForm';
import { ContractDocPreview } from './components/ContractDocPreview';

export function ContractModal({
  employee,
  compensationSnapshot,
  companyId,
  companyName,
  companyLogo,
  onClose,
  onSaved,
}: ContractModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [contractEnd, setContractEnd] = useState(toYmd(employee?.contractEndDate as string | Date | undefined) || '');
  const { rows, total } = useMemo(() => buildSalaryRows(compensationSnapshot), [compensationSnapshot]);

  const { printRef, saving, handlePrint, handleSaveToDocuments, printPreviewModal } = useEmployeeDocPrintSave({
    t,
    showToast,
    printTitle: t('documentContract') || 'Employment Contract',
    companyId,
    employee,
    documentType: 'contract',
    filePrefix: 'employment-contract',
    companyName,
    companyLogo,
    onSaved,
    onClose,
    saveFailedMessage: t('saveFailed'),
  });

  return (
    <EmployeeDocModalShell
      title={t('documentContract') || 'عقد عمل'}
      onClose={() => onClose?.()}
      onPrint={handlePrint}
      onSave={handleSaveToDocuments}
      saving={saving}
      t={t}
    >
      {printPreviewModal}
      <ContractDocForm contractEnd={contractEnd} setContractEnd={setContractEnd} />
      <EmployeeDocPrintFrame printRef={printRef}>
        <EmployeeDocDocumentFrame companyName={companyName} companyLogo={companyLogo} arabicTitle="عقد عمل" englishTitle="Employment Contract">
          <ContractDocPreview employee={employee} rows={rows} total={total} contractEnd={contractEnd} />
        </EmployeeDocDocumentFrame>
      </EmployeeDocPrintFrame>
    </EmployeeDocModalShell>
  );
}

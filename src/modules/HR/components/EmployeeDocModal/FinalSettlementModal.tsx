import React from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { useToast } from '../../../../context/ToastContext';
import { useEmployeeDocPrintSave } from './hooks/useEmployeeDocPrintSave';
import { useFinalSettlementDoc } from './hooks/useFinalSettlementDoc';
import type { FinalSettlementModalProps } from './types';
import { EmployeeDocModalShell } from './components/EmployeeDocModalShell';
import { EmployeeDocPrintFrame } from './components/EmployeeDocPrintFrame';
import { FinalSettlementPreview } from './components/FinalSettlementPreview';

export function FinalSettlementModal({
  employee,
  customAllowances = [],
  companyId,
  companyName,
  companyLogo,
  onClose,
  onSaved,
}: FinalSettlementModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const doc = useFinalSettlementDoc(employee, customAllowances);

  const { printRef, saving, handlePrint, handleSaveToDocuments } = useEmployeeDocPrintSave({
    t,
    showToast,
    printTitle: t('finalSettlement') || 'Final Settlement',
    companyId,
    employee,
    documentType: 'other',
    filePrefix: 'final-settlement',
    onSaved,
    onClose,
    saveFailedMessage: t('saveFailed'),
  });

  return (
    <EmployeeDocModalShell
      title={t('finalSettlement') || 'مخالصة نهائية'}
      onClose={() => onClose?.()}
      onPrint={handlePrint}
      onSave={handleSaveToDocuments}
      saving={saving}
      t={t}
    >
      <EmployeeDocPrintFrame printRef={printRef}>
        <FinalSettlementPreview
          employee={employee}
          companyName={companyName}
          companyLogo={companyLogo}
          t={t}
          rows={doc.rows}
          lastMonthlyComp={doc.lastMonthlyComp}
          includeEos={doc.includeEos}
          setIncludeEos={doc.setIncludeEos}
          eosEndDate={doc.eosEndDate}
          setEosEndDate={doc.setEosEndDate}
          eosReason={doc.eosReason}
          setEosReason={doc.setEosReason}
          eosSalary={doc.eosSalary}
          setEosSalary={doc.setEosSalary}
          eos={doc.eos}
          settlementDeclaration={doc.settlementDeclaration}
          overtimeHoursPerDay={doc.overtimeHoursPerDay}
        />
      </EmployeeDocPrintFrame>
    </EmployeeDocModalShell>
  );
}

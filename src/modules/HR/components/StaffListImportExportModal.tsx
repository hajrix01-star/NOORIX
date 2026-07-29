import React from 'react';
import type { QueryClient } from '@tanstack/react-query';
import ImportExportModal from '../../../components/ImportExportModal';
import { getEmployeesBulk } from '../../../services/api';
import { employeeKeys } from '../../../services/queryKeys';
import { buildCentralEmployeeExportRows } from '../staffListDataOps';

type TranslationFn = (key: string, ...args: string[]) => string;
type ToastVariant = 'success' | 'error' | 'info' | 'warning';

type StaffListImportExportModalProps = {
  isOpen: boolean;
  companyId: string;
  t: TranslationFn;
  queryClient: QueryClient;
  showToast: (message: string, variant?: ToastVariant) => void;
  onClose: () => void;
};

export function StaffListImportExportModal({
  isOpen,
  companyId,
  t,
  queryClient,
  showToast,
  onClose,
}: StaffListImportExportModalProps) {
  return (
    <ImportExportModal
      isOpen={isOpen}
      onClose={onClose}
      entityType="employees"
      companyId={companyId}
      exportFetcher={async () => {
        const res = await getEmployeesBulk(companyId, 'active');
        if (!res?.success) {
          throw new Error(res?.error || t('saveFailed'));
        }
        return buildCentralEmployeeExportRows(companyId, res.data || [], t);
      }}
      onImportSuccess={(count: number) => {
        queryClient.invalidateQueries({ queryKey: employeeKeys.root() });
        queryClient.invalidateQueries({ queryKey: employeeKeys.pagedByCompany(companyId) });
        showToast(t('employeesImportSuccessCount', String(count)), 'success');
      }}
    />
  );
}

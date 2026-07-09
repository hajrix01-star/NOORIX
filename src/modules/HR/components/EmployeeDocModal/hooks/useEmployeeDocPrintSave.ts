import { useRef, useState, useCallback } from 'react';
import { throwIfApiFailed } from '../../../../../services/api';
import { usePrintPreview } from '../../../../../ui';
import { uploadRenderedDocument } from '../utils/employeeDocPdf';
import { buildDocFileBaseName } from '../utils/employeeDocBuilders';
import { buildEmployeeDocPrintHtml } from '../utils/employeeDocPrint';
import type { EmployeeDocTFunction } from '../types';

type ShowToast = (message: string, type?: 'success' | 'error') => void;

export function useEmployeeDocPrintSave({
  t,
  showToast,
  printTitle,
  companyId,
  employee,
  documentType,
  filePrefix,
  companyName,
  companyLogo,
  onSaved,
  onClose,
  saveFailedMessage,
}: {
  t: EmployeeDocTFunction;
  showToast: ShowToast;
  printTitle: string;
  companyId: string | undefined;
  employee: Record<string, unknown>;
  documentType: string;
  filePrefix: string;
  companyName?: string;
  companyLogo?: string;
  onSaved?: () => void;
  onClose?: () => void;
  saveFailedMessage: string;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const { openPrintPreview, printPreviewModal } = usePrintPreview({
    title: printTitle,
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });

  const handlePrint = useCallback(() => {
    const html = buildEmployeeDocPrintHtml(printTitle, printRef.current?.innerHTML || '', { companyName, companyLogo });
    openPrintPreview({ title: printTitle, html });
  }, [printTitle, companyName, companyLogo, openPrintPreview]);

  const handleSaveToDocuments = useCallback(async () => {
    if (!employee?.id || !companyId) return;
    setSaving(true);
    try {
      const fileBaseName = buildDocFileBaseName(filePrefix, employee);
      const res = await uploadRenderedDocument({
        companyId,
        employeeId: String(employee.id),
        documentType,
        fileBaseName,
        html: printRef.current?.innerHTML || '',
      });
      throwIfApiFailed(res, saveFailedMessage);
      onSaved?.();
      onClose?.();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : 'فشل حفظ المستند';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }, [companyId, employee, documentType, filePrefix, onSaved, onClose, saveFailedMessage, showToast]);

  return { printRef, saving, handlePrint, handleSaveToDocuments, printPreviewModal };
}

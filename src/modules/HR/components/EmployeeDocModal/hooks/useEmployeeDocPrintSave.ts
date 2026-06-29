import { useRef, useState, useCallback } from 'react';
import { throwIfApiFailed } from '../../../../../services/api';
import { uploadRenderedDocument } from '../utils/employeeDocPdf';
import { buildDocFileBaseName } from '../utils/employeeDocBuilders';
import { buildPrintWindow } from '../utils/employeeDocPrint';
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
  onSaved?: () => void;
  onClose?: () => void;
  saveFailedMessage: string;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const handlePrint = useCallback(() => {
    const win = buildPrintWindow(printTitle, printRef.current?.innerHTML || '');
    if (!win) {
      showToast(t('allowPopupsForPrint') || 'يرجى السماح بالنوافذ المنبثقة للموقع ثم المحاولة مرة أخرى', 'error');
      return;
    }
    win.onload = () => {
      win.onafterprint = () => win.close();
      win.print();
    };
  }, [printTitle, t, showToast]);

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

  return { printRef, saving, handlePrint, handleSaveToDocuments };
}

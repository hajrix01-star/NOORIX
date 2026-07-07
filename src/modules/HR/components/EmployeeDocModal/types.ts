import type { CSSProperties } from 'react';
import type { HrCompensationSnapshot } from '../../../../types/api';

/** كائن يشبه نافذة الطباعة — الحقول قابلة للتعيين بعد `openPrintWindow` الداخلي */
export type PrintWindowStub = {
  onload: (() => void) | null;
  onafterprint: (() => void) | null;
  print: () => void;
  close: () => void;
};

export type EmployeeDocModalBaseProps = {
  employee: Record<string, unknown>;
  compensationSnapshot: HrCompensationSnapshot;
  companyId?: string;
  companyName?: string;
  companyLogo?: string;
  onClose?: () => void;
  onSaved?: () => void;
};

export type SalaryCertificateModalProps = EmployeeDocModalBaseProps;
export type ContractModalProps = EmployeeDocModalBaseProps;
export type FinalSettlementModalProps = EmployeeDocModalBaseProps;

export type DocSalaryRow = { ar: string; en: string; amount: number };

export type DocStylesBundle = {
  DOC_GRID: CSSProperties;
  DOC_SEP: CSSProperties;
  DOC_TABLE_BASE: CSSProperties;
  DOC_TH: CSSProperties;
  DOC_TD: CSSProperties;
  DOC_BOX: CSSProperties;
  DOC_H3: CSSProperties;
  SETTLE_SECTION: CSSProperties;
};

export type TerminationSummary = {
  ar: string;
  en: string;
  clauseAr: string;
  clauseEn: string;
  terminationDate: string;
  reasonCode: string;
};

export type EmployeeDocTFunction = (key: string, vars?: Record<string, string | number>) => string;

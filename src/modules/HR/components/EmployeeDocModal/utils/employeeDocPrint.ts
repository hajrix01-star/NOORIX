import { buildPrintDocumentHtml } from '../../../../../utils/printUtils';
import { EMPLOYEE_DOC_EXTRA_CSS } from '../constants';

export type EmployeeDocPrintOptions = {
  companyName?: string;
  companyLogo?: string;
};

export function buildEmployeeDocPrintHtml(title: string, html: string, _options: EmployeeDocPrintOptions = {}): string {
  return buildPrintDocumentHtml({
    title,
    subtitle: title,
    body: html,
    extraCss: EMPLOYEE_DOC_EXTRA_CSS,
  });
}

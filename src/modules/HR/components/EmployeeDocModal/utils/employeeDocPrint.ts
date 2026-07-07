import { openPrintWindow } from '../../../../../utils/printUtils';
import { EMPLOYEE_DOC_EXTRA_CSS } from '../constants';

export function buildPrintWindow(title: string, html: string): Window | null {
  return openPrintWindow({ title, body: html, extraCss: EMPLOYEE_DOC_EXTRA_CSS });
}

import { openPrintWindow } from '../../../../../utils/printUtils';
import { EMPLOYEE_DOC_EXTRA_CSS } from '../constants';
import type { PrintWindowStub } from '../types';

export function buildPrintWindow(title: string, html: string): PrintWindowStub {
  openPrintWindow({ title, body: html, extraCss: EMPLOYEE_DOC_EXTRA_CSS });
  return {
    onload: null,
    onafterprint: null,
    print: () => {},
    close: () => {},
  };
}

import { describe, it, expect } from 'vitest';
import InvoicesListScreen, {
  useInvoicesListScreen,
  nextInvoiceSortState,
  PAGE_SIZE,
  buildInvoiceExportColumnDefs,
  buildInvoiceKindFilterOptions,
  invoiceToExportRow,
} from './index';

describe('invoices module barrel', () => {
  it('default export is the list screen component', () => {
    expect(typeof InvoicesListScreen).toBe('function');
  });

  it('re-exports hook and sort helper', () => {
    expect(typeof useInvoicesListScreen).toBe('function');
    expect(typeof nextInvoiceSortState).toBe('function');
  });

  it('re-exports helpers and export model', () => {
    expect(PAGE_SIZE).toBe(50);
    expect(typeof buildInvoiceExportColumnDefs).toBe('function');
    expect(typeof buildInvoiceKindFilterOptions).toBe('function');
    expect(typeof invoiceToExportRow).toBe('function');
  });
});

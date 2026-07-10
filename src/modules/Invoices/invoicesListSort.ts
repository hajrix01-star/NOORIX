import type { InvoiceListSortDir } from './invoicesListQueryModel';

export type InvoiceListSortState = {
  sortKey: string;
  sortDir: InvoiceListSortDir;
};

export function nextInvoiceSortState(
  sortKey: string,
  sortDir: InvoiceListSortDir,
  clickedKey: string,
): InvoiceListSortState {
  if (sortKey === clickedKey) {
    return { sortKey, sortDir: sortDir === 'desc' ? 'asc' : 'desc' };
  }
  return { sortKey: clickedKey, sortDir: 'desc' };
}

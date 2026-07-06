import { getInvoices, unwrapApiList } from '../../services/api';
import type { InvoiceListItem } from '../../services/domains/apiEndpoints/invoice-list-response';
import { formatInvoiceForExport } from '../../utils/importTemplates';
import { buildInvoiceListFetchParams, type InvoiceListFetchParams } from './invoicesListQueryModel';

export type InvoiceListImportExportFetchSource = {
  companyId: string;
  startDate: string;
  endDate: string;
  filterKind: string;
  urlExtra: {
    kind: string;
    categoryId: string;
    expenseLineId: string;
  };
  sortBy: string;
  sortDir: string;
  supplierId: string;
  supplierCategoryId: string;
  q: string;
  hasNotes: boolean;
  vaultId: string;
  batchId: string;
  createdByUserId: string;
};

export function buildInvoiceImportExportFetchParams(
  input: InvoiceListImportExportFetchSource,
): InvoiceListFetchParams {
  return buildInvoiceListFetchParams({
    companyId: input.companyId,
    startDate: input.startDate,
    endDate: input.endDate,
    kind: input.filterKind || (input.urlExtra.kind ? input.urlExtra.kind.split(',')[0] : ''),
    sortBy: input.sortBy,
    sortDir: input.sortDir,
    supplierId: input.supplierId,
    supplierCategoryId: input.supplierCategoryId,
    q: input.q,
    categoryId: input.urlExtra.categoryId,
    expenseLineId: input.urlExtra.expenseLineId,
    includeCancelled: true,
    hasNotes: input.hasNotes,
    vaultId: input.vaultId,
    batchId: input.batchId,
    createdByUserId: input.createdByUserId,
  });
}

export async function fetchInvoicesForImportExportExport(
  input: InvoiceListImportExportFetchSource & {
    exportFailedMessage: string;
  },
) {
  const params = buildInvoiceImportExportFetchParams(input);
  const res = await getInvoices(
    params.companyId,
    params.startDate,
    params.endDate,
    1,
    2000,
    params.batchId || null,
    undefined,
    params.kind,
    params.sortBy,
    params.sortDir,
    params.supplierId,
    params.supplierCategoryId,
    params.q,
    params.categoryId,
    params.expenseLineId,
    params.includeCancelled,
    params.hasNotes,
    params.vaultId,
    params.createdByUserId,
  );
  return unwrapApiList<InvoiceListItem>(res, input.exportFailedMessage).map(formatInvoiceForExport);
}

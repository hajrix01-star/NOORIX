export type CreateInvoiceBatchResult = {
  batchId: string;
  count: number;
  invoices: Array<{ id: string }>;
};

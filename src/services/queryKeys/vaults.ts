/**
 * مفاتيح React Query — الخزائن وخيارات الدفع
 */
export const vaultKeys = {
  list: (companyId: string, includeArchived: boolean, startDate: string, endDate: string) =>
    ['vaults', companyId, includeArchived, startDate, endDate] as const,

  paymentOptions: (companyId: string) => ['payment-vaults', companyId] as const,

  /** بادئة إبطال كل استعلامات الخزائن لشركة */
  byCompany: (companyId: string) => ['vaults', companyId] as const,

  /** واجهات تعتمد 3-عناصر فقط (مثلاً SmartChat) */
  shortActive: (companyId: string) => ['vaults', companyId, false] as const,

  /** تبويب OCR: خزائن للربط */
  ocrFinalize: (companyId: string) => ['vaults', companyId, 'ocr-finalize'] as const,

  transactions: (vaultId: unknown, companyId: string, startDate: unknown, endDate: unknown, page: number) =>
    ['vault-transactions', vaultId, companyId, startDate, endDate, page] as const,

  paymentVaultsRoot: () => ['payment-vaults'] as const,

  vaultTransactionsRoot: () => ['vault-transactions'] as const,

  /** بادئة إبطال كل الخزائن */
  root: () => ['vaults'] as const,
};

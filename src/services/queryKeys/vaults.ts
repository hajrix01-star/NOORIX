/**
 * مفاتيح React Query — الخزائن وخيارات الدفع
 */
export const vaultKeys = {
  list: (companyId: string, includeArchived: boolean, startDate: string, endDate: string) =>
    ['vaults', companyId, includeArchived, startDate, endDate] as const,

  paymentOptions: (companyId: string) => ['payment-vaults', companyId] as const,

  /** بادئة إبطال كل استعلامات الخزائن لشركة */
  byCompany: (companyId: string) => ['vaults', companyId] as const,
};

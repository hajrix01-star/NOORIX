/**
 * مفاتيح React Query — الموردون
 */
export const supplierKeys = {
  list: (companyId: string, pageSize: number, q: string) =>
    ['suppliers', companyId, pageSize, q] as const,

  /** بادئة إبطال كل قوائم موردي شركة */
  byCompany: (companyId: string) => ['suppliers', companyId] as const,

  root: () => ['suppliers'] as const,
};

export const supplierKeys = {
  list: (companyId: string, pageSize: number, q: string) =>
    ['suppliers', companyId, pageSize, q] as const,

  byCompany: (companyId: string) => ['suppliers', companyId] as const,

  root: () => ['suppliers'] as const,
};

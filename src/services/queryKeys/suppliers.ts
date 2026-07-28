export const supplierKeys = {
  list: (companyId: string, pageSize: number, q: string) =>
    ['suppliers', companyId, pageSize, q] as const,

  byCompany: (companyId: string) => ['suppliers', companyId] as const,

  root: () => ['suppliers'] as const,

  directory: (companyId: string, q: string) =>
    ['supplier-directory', companyId, q] as const,

  directoryByCompany: (companyId: string) =>
    ['supplier-directory', companyId] as const,
};

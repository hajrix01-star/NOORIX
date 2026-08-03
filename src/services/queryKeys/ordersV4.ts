export const ordersV4Keys = {
  root: ['orders-v4'] as const,
  bootstrap: (companyId: string) => ['orders-v4', 'bootstrap', companyId] as const,
  documentsRoot: (companyId: string) => ['orders-v4', 'documents', companyId] as const,
  documents: (companyId: string, type: string, startDate: string, endDate: string, limit: number) =>
    ['orders-v4', 'documents', companyId, type, startDate, endDate, limit] as const,
  reports: (companyId: string) => ['orders-v4', 'reports', companyId] as const,
  inventory: (companyId: string) => ['orders-v4', 'inventory', companyId] as const,
};

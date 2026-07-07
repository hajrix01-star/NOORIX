import type { AssetWarrantyFilter } from '../../types/api';

export const assetKeys = {
  register: (
    companyId: string,
    warrantyFilter: AssetWarrantyFilter,
    q: string,
    page: number,
    pageSize: number,
  ) => ['company-assets', companyId, warrantyFilter, q, page, pageSize] as const,

  pendingWarranty: (companyId: string) => ['company-assets', companyId, 'pending-warranty'] as const,

  root: () => ['company-assets'] as const,
};

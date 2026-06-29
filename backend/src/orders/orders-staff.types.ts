export interface StaffOrderItemInput {
  productId: string;
  quantity: string;
  unit?: string;
  size?: string;
  packaging?: string;
  unitPrice?: string;
  notes?: string;
  sectionName?: string;
}

export type SendStaffDigestOptions = {
  lang?: 'ar' | 'en';
  orderType?: 'external' | 'internal';
  pettyCashAmount?: string;
  orderDate?: string;
  createPurchaseOrder?: boolean;
};

export interface CreateStaffOrderDto {
  companyId: string;
  sectionName?: string;
  orderType?: string;
  saleDate?: string;
  notes?: string;
  items: StaffOrderItemInput[];
  lang?: 'ar' | 'en';
}

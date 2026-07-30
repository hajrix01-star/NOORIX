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

export interface CreateStaffOrderDto {
  companyId: string;
  sectionName?: string;
  orderType?: string;
  saleDate?: string;
  notes?: string;
  items: StaffOrderItemInput[];
  lang?: 'ar' | 'en';
}

export type StaffOrderEntryType = 'issue' | 'cancellation';

export type StaffCancellationReason =
  | 'customer_disliked'
  | 'replaced_item'
  | 'order_error'
  | 'registration_error'
  | 'delayed_order'
  | 'duplicate_order'
  | 'customer_changed_mind'
  | 'item_unavailable'
  | 'other';

export interface StaffOrderItemInput {
  productId: string;
  quantity: string;
  unit?: string;
  size?: string;
  packaging?: string;
  unitPrice?: string;
  notes?: string;
  sectionName?: string;
  cancellationReasons?: StaffCancellationReason[];
}

export interface CreateStaffOrderDto {
  companyId: string;
  sectionName?: string;
  orderType?: string;
  entryType?: StaffOrderEntryType;
  saleDate?: string;
  notes?: string;
  items: StaffOrderItemInput[];
  lang?: 'ar' | 'en';
}

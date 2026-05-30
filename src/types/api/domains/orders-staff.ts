/** GET /api/v1/orders/staff/digest */
export type StaffDigestOrderItem = {
  quantity?: number | string;
  unit?: string | null;
  size?: string | null;
  packaging?: string | null;
  unitPrice?: number | string | null;
  product?: { nameAr?: string | null; nameEn?: string | null } | null;
};

export type StaffDigestOrder = {
  id: string;
  notes?: string | null;
  createdAt?: string;
  user?: { nameAr?: string | null; nameEn?: string | null } | null;
  items?: StaffDigestOrderItem[];
};

export type StaffDigestSection = {
  sectionName: string;
  totalItems: number;
  orders: StaffDigestOrder[];
};

export type StaffDigestData = {
  sections: StaffDigestSection[];
  totalOrders: number;
  pendingCount: number;
};

/** POST /api/v1/orders/staff/send-digest */
export type StaffDigestSendResult = {
  sent?: number;
  whatsAppText?: string;
  grandTotal?: string;
  purchaseOrder?: {
    id: string;
    orderNumber: string;
    totalAmount: number | string;
    orderType: string;
  } | null;
};

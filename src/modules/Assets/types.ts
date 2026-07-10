import type {
  AssetRegisterItem,
  AssetSupplierRef,
  PendingWarrantyInvoiceRow,
} from '../../types/api';

export const ASSET_SECTION_TAB_IDS = ['register', 'queue'] as const;

export type AssetSectionTabId = (typeof ASSET_SECTION_TAB_IDS)[number];

export type SupplierOption = AssetSupplierRef;
export type AssetRegisterListItem = AssetRegisterItem;
export type { PendingWarrantyInvoiceRow };

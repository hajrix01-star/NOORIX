/**
 * مفاتيح تصنيف موردي OCR — تُخزَّن في supplierCategory وتُعرَض عبر i18n.
 */
export const OCR_SUPPLIER_CATEGORY_OPTIONS = [
  { value: '', labelKey: 'ocrSupplierCatNone' },
  { value: 'food_beverage', labelKey: 'ocrSupplierCatFoodBeverage' },
  { value: 'retail_wholesale', labelKey: 'ocrSupplierCatRetailWholesale' },
  { value: 'services', labelKey: 'ocrSupplierCatServices' },
  { value: 'fuel_transport', labelKey: 'ocrSupplierCatFuelTransport' },
  { value: 'construction_materials', labelKey: 'ocrSupplierCatConstruction' },
  { value: 'it_equipment', labelKey: 'ocrSupplierCatItEquipment' },
  { value: 'packaging_consumables', labelKey: 'ocrSupplierCatPackaging' },
  { value: 'other', labelKey: 'ocrSupplierCatOther' },
];

/** تسمية التصنيف للعرض في القوائم */
export function ocrSupplierCategoryLabel(value: any, t: any) {
  const v = value == null ? '' : String(value);
  const row = OCR_SUPPLIER_CATEGORY_OPTIONS.find((o: any) => o.value === v);
  if (row?.labelKey) return t(row.labelKey);
  return v || '—';
}

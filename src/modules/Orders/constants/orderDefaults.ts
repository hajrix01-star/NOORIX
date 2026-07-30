/**
 * قيم افتراضية للأحجام والتغليف — متعارف عليها بالسعودية
 */
import { readJsonStorage, writeJsonStorage } from '../../../utils/jsonStorage';
export type OrderOption = { ar: string; en: string; isDefault?: boolean };
export const DEFAULT_SIZES = [
  { ar: 'صغير', en: 'Small' },
  { ar: 'وسط', en: 'Medium' },
  { ar: 'كبير', en: 'Large' },
  { ar: 'عائلة', en: 'Family' },
  { ar: 'جumbo', en: 'Jumbo' },
  { ar: 'كيلو', en: 'Kilo' },
  { ar: 'نص كيلو', en: 'Half Kilo' },
  { ar: 'ربع كيلو', en: 'Quarter Kilo' },
];

export const DEFAULT_PACKAGING = [
  { ar: 'ربع علبة', en: 'Quarter box' },
  { ar: 'نصف علبة', en: 'Half box' },
  { ar: 'علبة', en: 'Box' },
  { ar: 'علبة ونصف', en: 'One and a half boxes' },
  { ar: 'ربع كرتون', en: 'Quarter carton' },
  { ar: 'نصف كرتون', en: 'Half carton' },
  { ar: 'كرتون', en: 'Carton' },
  { ar: 'كرتون ونصف', en: 'One and a half cartons' },
  { ar: 'كيس', en: 'Bag' },
  { ar: 'صندوق', en: 'Crate' },
  { ar: 'حزمة', en: 'Bundle' },
  { ar: 'قطعة', en: 'Piece' },
  { ar: 'زجاجة', en: 'Bottle' },
  { ar: 'عبوة', en: 'Pack' },
];

const STORAGE_KEY_SIZES = 'noorix_order_sizes';
const STORAGE_KEY_PACKAGING = 'noorix_order_packaging';

function loadCustom(companyId: string, key: string): OrderOption[] {
  const parsed = readJsonStorage<unknown>(`${key}_${companyId}`, null);
  return Array.isArray(parsed) ? parsed.filter((item): item is OrderOption => typeof item === 'object' && item !== null && 'ar' in item) : [];
}

function saveCustom(companyId: string, key: string, items: OrderOption[]) {
  if (!writeJsonStorage(`${key}_${companyId}`, items)) {
    console.warn('Failed to save order defaults to localStorage');
  }
}

export function getSizesOptions(companyId: string): OrderOption[] {
  const custom = loadCustom(companyId, STORAGE_KEY_SIZES);
  const defaults = DEFAULT_SIZES.map((d) => ({ ar: d.ar, en: d.en, isDefault: true }));
  const customMapped = custom.map((c) => ({ ar: c.ar, en: c.en || '', isDefault: false }));
  const seen = new Set<string>();
  return [...defaults, ...customMapped].filter((x) => {
    const k = (x.ar || '').trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function getPackagingOptions(companyId: string): OrderOption[] {
  const custom = loadCustom(companyId, STORAGE_KEY_PACKAGING);
  const defaults = DEFAULT_PACKAGING.map((d) => ({ ar: d.ar, en: d.en, isDefault: true }));
  const customMapped = custom.map((c) => ({ ar: c.ar, en: c.en || '', isDefault: false }));
  const seen = new Set<string>();
  return [...defaults, ...customMapped].filter((x) => {
    const k = (x.ar || '').trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function addCustomSize(companyId: string, ar: string, en?: string) {
  const custom = loadCustom(companyId, STORAGE_KEY_SIZES);
  const trimmed = (ar || '').trim();
  if (!trimmed) return;
  if (custom.some((c) => (c.ar || '').toLowerCase() === trimmed.toLowerCase())) return;
  custom.push({ ar: trimmed, en: (en || '').trim() });
  saveCustom(companyId, STORAGE_KEY_SIZES, custom);
}

export function addCustomPackaging(companyId: string, ar: string, en?: string) {
  const custom = loadCustom(companyId, STORAGE_KEY_PACKAGING);
  const trimmed = (ar || '').trim();
  if (!trimmed) return;
  if (custom.some((c) => (c.ar || '').toLowerCase() === trimmed.toLowerCase())) return;
  custom.push({ ar: trimmed, en: (en || '').trim() });
  saveCustom(companyId, STORAGE_KEY_PACKAGING, custom);
}

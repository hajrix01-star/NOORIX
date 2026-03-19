/**
 * قيم افتراضية للأحجام والتغليف — متعارف عليها بالسعودية
 */
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
  { ar: 'علبة', en: 'Box' },
  { ar: 'كرتون', en: 'Carton' },
  { ar: 'كيس', en: 'Bag' },
  { ar: 'صندوق', en: 'Crate' },
  { ar: 'حزمة', en: 'Bundle' },
  { ar: 'قطعة', en: 'Piece' },
  { ar: 'زجاجة', en: 'Bottle' },
  { ar: 'عبوة', en: 'Pack' },
];

const STORAGE_KEY_SIZES = 'noorix_order_sizes';
const STORAGE_KEY_PACKAGING = 'noorix_order_packaging';

function loadCustom(companyId, key) {
  try {
    const raw = localStorage.getItem(`${key}_${companyId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustom(companyId, key, items) {
  try {
    localStorage.setItem(`${key}_${companyId}`, JSON.stringify(items));
  } catch (e) {
    console.warn('Failed to save to localStorage', e);
  }
}

export function getSizesOptions(companyId) {
  const custom = loadCustom(companyId, STORAGE_KEY_SIZES);
  const defaults = DEFAULT_SIZES.map((d) => ({ ar: d.ar, en: d.en, isDefault: true }));
  const customMapped = custom.map((c) => ({ ar: c.ar, en: c.en || '', isDefault: false }));
  const seen = new Set();
  return [...defaults, ...customMapped].filter((x) => {
    const k = (x.ar || '').trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function getPackagingOptions(companyId) {
  const custom = loadCustom(companyId, STORAGE_KEY_PACKAGING);
  const defaults = DEFAULT_PACKAGING.map((d) => ({ ar: d.ar, en: d.en, isDefault: true }));
  const customMapped = custom.map((c) => ({ ar: c.ar, en: c.en || '', isDefault: false }));
  const seen = new Set();
  return [...defaults, ...customMapped].filter((x) => {
    const k = (x.ar || '').trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function addCustomSize(companyId, ar, en) {
  const custom = loadCustom(companyId, STORAGE_KEY_SIZES);
  const trimmed = (ar || '').trim();
  if (!trimmed) return;
  if (custom.some((c) => (c.ar || '').toLowerCase() === trimmed.toLowerCase())) return;
  custom.push({ ar: trimmed, en: (en || '').trim() });
  saveCustom(companyId, STORAGE_KEY_SIZES, custom);
}

export function addCustomPackaging(companyId, ar, en) {
  const custom = loadCustom(companyId, STORAGE_KEY_PACKAGING);
  const trimmed = (ar || '').trim();
  if (!trimmed) return;
  if (custom.some((c) => (c.ar || '').toLowerCase() === trimmed.toLowerCase())) return;
  custom.push({ ar: trimmed, en: (en || '').trim() });
  saveCustom(companyId, STORAGE_KEY_PACKAGING, custom);
}

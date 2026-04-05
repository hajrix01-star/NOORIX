/**
 * Arabic Normalization Utility — تطبيع النصوص العربية
 * يُستخدم قبل أي مقارنة نصية لضمان التوحيد
 */

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/g;

// حروف الجر والتعريف الشائعة التي تُحذف
const PREP_PREFIXES = /^(ال|بال|وال|فال|كال|لل|في|من|على|إلى|الى|عن|مع|ب|و|ف|ل|ك)/;

const UNIT_MAP: Record<string, string> = {
  'لتر': 'L', 'ليتر': 'L', 'litre': 'L', 'liter': 'L', 'lt': 'L',
  'كيلو': 'KG', 'كيلوجرام': 'KG', 'كغ': 'KG', 'kg': 'KG', 'kilogram': 'KG',
  'جرام': 'G', 'غرام': 'G', 'gram': 'G', 'g': 'G',
  'مل': 'ML', 'ملليلتر': 'ML', 'ml': 'ML', 'milliliter': 'ML',
  'علبة': 'BOX', 'كرتون': 'CTN', 'carton': 'CTN', 'box': 'BOX',
  'قطعة': 'PCS', 'حبة': 'PCS', 'piece': 'PCS', 'pcs': 'PCS',
  'دزينة': 'DZ', 'dozen': 'DZ',
};

/**
 * تطبيع شامل للنص العربي والإنجليزي
 * يُعيد نصاً نظيفاً موحداً للمقارنة
 */
export function normalize(text: string): string {
  if (!text) return '';

  let t = text.trim();

  // 1. حذف التشكيل
  t = t.replace(ARABIC_DIACRITICS, '');

  // 2. توحيد الألف (أ / إ / آ / ا → ا)
  t = t.replace(/[أإآٱ]/g, 'ا');

  // 3. توحيد التاء المربوطة (ة → ه)
  t = t.replace(/ة/g, 'ه');

  // 4. توحيد الياء (ى → ي)
  t = t.replace(/ى/g, 'ي');

  // 5. توحيد الواو المدية
  t = t.replace(/ؤ/g, 'و');

  // 6. توحيد الهمزة على النبرة
  t = t.replace(/ئ/g, 'ي');

  // 7. توحيد الأرقام الهندية والعربية → أرقام غربية
  t = t.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  t = t.replace(/[۰۱۲۳۴۵۶۷۸۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));

  // 8. حذف علامات الترقيم والرموز الزائدة
  t = t.replace(/[،,;:؟?!()[\]{}"'«»\-_/\\|@#$%^&*+=<>~`]/g, ' ');

  // 9. تحويل الإنجليزي إلى lowercase
  t = t.toLowerCase();

  // 10. تطبيع الوحدات
  t = t.replace(/(\d+\.?\d*)\s*([أ-يa-z]+)/gi, (_, num, unit) => {
    const unitNorm = UNIT_MAP[unit.toLowerCase()] || UNIT_MAP[normalize(unit)] || unit;
    return `${num}${unitNorm}`;
  });

  // 11. تطبيع المسافات
  t = t.replace(/\s+/g, ' ').trim();

  return t;
}

/**
 * تطبيع مع حذف حروف الجر وأل التعريف (للمقارنة العميقة)
 */
export function normalizeDeep(text: string): string {
  let t = normalize(text);

  // حذف كل token يبدأ بحرف جر أو أل
  const tokens = t.split(' ').map((token) => {
    let tt = token;
    // حذف البادئات مرة أو مرتين (لل، بالزيت)
    for (let i = 0; i < 2; i++) {
      tt = tt.replace(PREP_PREFIXES, '');
    }
    return tt;
  });

  return tokens.filter(Boolean).join(' ');
}

/**
 * تقسيم النص إلى tokens بعد التطبيع
 */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t.length > 1);
}

/**
 * تقسيم عميق مع حذف حروف الجر
 */
export function tokenizeDeep(text: string): string[] {
  return normalizeDeep(text)
    .split(' ')
    .filter((t) => t.length > 1);
}

/**
 * قائمة أصناف مقترحة: فئة، وحدة معروضة، متوسط سعر — للإدراج/المزامنة من إدارة الأصناف.
 * الوحدة تُخزَّن كحجم/وصف في التركيبة مع استنتاج piece | kg | box | dozen للنظام.
 */

/** تحويل نص الوحدة إلى وحدة الطلبات في الـ API */
export function inferPresetOrderUnitEnum(unitLabel) {
  const s = String(unitLabel ?? '').trim();
  if (!s || s === '-' || s === '—') return 'piece';
  const t = s.replace(/\s+/g, ' ');
  const low = t.toLowerCase();
  if (low.includes('درزن')) return 'dozen';
  if (low.includes('كرتون') || low.includes('نص كرتون')) return 'box';
  if (low.includes('كيس')) return 'box';
  if (low.includes('كجم') || low.includes('كيلو')) return 'kg';
  if (t === 'كج') return 'kg';
  return 'piece';
}

/** حقول variants + lastPrice لإنشاء/تحديث الصنف */
export function presetRowToProductPayload(row) {
  const price = Number(row.avgPrice);
  const priceStr = Number.isFinite(price) ? price.toFixed(2) : '0';
  let size = String(row.unitLabel ?? '').trim();
  if (!size || size === '-') size = '—';
  const unit = inferPresetOrderUnitEnum(row.unitLabel);
  const variants = [{ size, packaging: '', unit, lastPrice: priceStr }];
  return { variants, lastPrice: priceStr, unit };
}

export const BROASTED_PRESET_ORDER_PRODUCTS = [
  { nameAr: 'لحم خروف', categoryAr: 'لحوم ودواجن', unitLabel: 'خروف كامل', avgPrice: 1157.45 },
  { nameAr: 'لحم اوصال خام', categoryAr: 'لحوم ودواجن', unitLabel: 'كجم', avgPrice: 46.57 },
  { nameAr: 'صدور مجمده', categoryAr: 'لحوم ودواجن', unitLabel: 'حبة', avgPrice: 10.17 },
  { nameAr: 'لحم خروف بالكيلو', categoryAr: 'لحوم ودواجن', unitLabel: 'كج', avgPrice: 418.44 },
  { nameAr: 'دجاج 1000 جرام للبروستد', categoryAr: 'لحوم ودواجن', unitLabel: 'حبة', avgPrice: 15.33 },
  { nameAr: 'دجاج 900 مبرد', categoryAr: 'لحوم ودواجن', unitLabel: 'حبة', avgPrice: 15.01 },
  { nameAr: 'بطاطس امريكانا', categoryAr: 'خضروات وفواكه', unitLabel: 'كرتون', avgPrice: 62.56 },
  { nameAr: 'بيبسي', categoryAr: 'مشروبات', unitLabel: 'كرتون', avgPrice: 372.56 },
  { nameAr: 'شحم', categoryAr: 'لحوم ودواجن', unitLabel: 'كجم', avgPrice: 18.09 },
  { nameAr: 'غاز', categoryAr: 'مواد تنظيف', unitLabel: 'سلندر', avgPrice: 28.46 },
  { nameAr: 'زيت الوليد', categoryAr: 'زيوت وسمن', unitLabel: 'حبة', avgPrice: 140.07 },
  { nameAr: 'زيت العربي', categoryAr: 'زيوت وسمن', unitLabel: 'حبة', avgPrice: 109.59 },
  { nameAr: 'طحينه الجميل 10 لتر', categoryAr: 'صلصات ومعجنات', unitLabel: 'حبة', avgPrice: 133.11 },
  { nameAr: 'دجاج 1100 جم', categoryAr: 'لحوم ودواجن', unitLabel: 'حبة', avgPrice: 15.1 },
  { nameAr: 'طماط شوكة', categoryAr: 'خضروات وفواكه', unitLabel: '9 كجم', avgPrice: 20.95 },
  { nameAr: 'بترول اسامة', categoryAr: 'مواد أخرى', unitLabel: '-', avgPrice: 82.33 },
  { nameAr: 'فحم', categoryAr: 'مواد أخرى', unitLabel: 'كيف', avgPrice: 72 },
  { nameAr: 'باذنجان اسود متبل', categoryAr: 'خضروات وفواكه', unitLabel: '20 كجم', avgPrice: 32.96 },
  { nameAr: 'ارز 10 كيلو', categoryAr: 'حبوب ودقيق', unitLabel: 'كيس', avgPrice: 65.3 },
  { nameAr: 'طحين سعودي 45 كيلو', categoryAr: 'حبوب ودقيق', unitLabel: 'كيس', avgPrice: 42.54 },
  { nameAr: 'فلفل احمر بارد', categoryAr: 'خضروات وفواكه', unitLabel: '5 كجم', avgPrice: 32.31 },
  { nameAr: 'صلصة تركي 5 كيلو', categoryAr: 'صلصات ومعجنات', unitLabel: 'حبة', avgPrice: 62.75 },
  { nameAr: 'ليمون', categoryAr: 'خضروات وفواكه', unitLabel: '8 كجم', avgPrice: 39.75 },
  { nameAr: 'حمص رقم 12 --15 كجم', categoryAr: 'حبوب ودقيق', unitLabel: 'كجم', avgPrice: 107.5 },
  { nameAr: 'سفرة 110*100', categoryAr: 'أدوات تقديم', unitLabel: 'شدة', avgPrice: 69.33 },
  { nameAr: 'زيت ابو زهرة 9 لتر', categoryAr: 'زيوت وسمن', unitLabel: 'حبة', avgPrice: 11.01 },
  { nameAr: 'بهارات بروستد', categoryAr: 'بهارات وتوابل', unitLabel: 'حار', avgPrice: 200 },
  { nameAr: 'قصدير ثلاثين سم - 450 متر', categoryAr: 'أدوات تغليف', unitLabel: 'قطعه', avgPrice: 38.55 },
  { nameAr: 'قصدير صغير خمس واربعون-150 متر', categoryAr: 'مواد أخرى', unitLabel: 'قطعه', avgPrice: 51 },
  { nameAr: 'بصل مصري وسط', categoryAr: 'خضروات وفواكه', unitLabel: '20 كجم', avgPrice: 30.68 },
  { nameAr: 'جبن شيدر', categoryAr: 'ألبان وبيض', unitLabel: '3 قطع كجم', avgPrice: 49 },
  { nameAr: 'مناديل تاير', categoryAr: 'أدوات تقديم', unitLabel: 'حبة', avgPrice: 32.28 },
  { nameAr: 'جرجير', categoryAr: 'حبوب ودقيق', unitLabel: '20 حبة', avgPrice: 15.21 },
  { nameAr: 'فلفل مشوي', categoryAr: 'خضروات وفواكه', unitLabel: '4 كجم', avgPrice: 23.5 },
  { nameAr: 'بصل ابيض', categoryAr: 'خضروات وفواكه', unitLabel: '13 كجم', avgPrice: 38.21 },
  { nameAr: 'علبة ثوم اسود-2000 حبة', categoryAr: 'بهارات وتوابل', unitLabel: 'كرتون', avgPrice: 88.67 },
  { nameAr: 'زيت زيتون السوسن', categoryAr: 'زيوت وسمن', unitLabel: 'حبة', avgPrice: 128 },
  { nameAr: 'ماء 50', categoryAr: 'مشروبات', unitLabel: '50', avgPrice: 50 },
  { nameAr: 'اكياس ورق', categoryAr: 'أدوات تغليف', unitLabel: 'نفر', avgPrice: 34.29 },
  { nameAr: 'بصل مشوي وسط', categoryAr: 'خضروات وفواكه', unitLabel: '13 كجم', avgPrice: 21.36 },
  { nameAr: 'صحن نفر-150 حبة', categoryAr: 'أدوات تقديم', unitLabel: 'كرتون', avgPrice: 47 },
  { nameAr: 'نايلون تغليف', categoryAr: 'أدوات تغليف', unitLabel: 'صغير', avgPrice: 32.29 },
  { nameAr: 'مخلل مشكل 6 كيلو', categoryAr: 'مواد أخرى', unitLabel: 'حبة', avgPrice: 24.92 },
  { nameAr: 'علبة حمص صغير بلاستك -50 حبة شدة', categoryAr: 'أدوات تغليف', unitLabel: 'شدة', avgPrice: 18.59 },
  { nameAr: 'قفازات', categoryAr: 'أدوات تنظيف', unitLabel: 'نص كرتون', avgPrice: 18.25 },
  { nameAr: 'صابون سائل فيري', categoryAr: 'مواد تنظيف', unitLabel: '20 لنر', avgPrice: 105 },
  { nameAr: 'دبس رمان', categoryAr: 'صلصات ومعجنات', unitLabel: 'حبة', avgPrice: 14.86 },
  { nameAr: 'بقدونس', categoryAr: 'خضروات وفواكه', unitLabel: '20 جبة', avgPrice: 12 },
  { nameAr: 'صحن بروستد شدة 100 بحة', categoryAr: 'أدوات تقديم', unitLabel: 'شدة', avgPrice: 26.14 },
  { nameAr: 'ملاعق بلاستك بيضاء', categoryAr: 'أدوات تقديم', unitLabel: 'كرتون', avgPrice: 60.67 },
];

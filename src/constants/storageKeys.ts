/**
 * مفاتيح localStorage الموحّدة — مرجع واحد يقلّل التباين بين الملفات.
 */
export { CARD_STYLE_KEY } from './cardStyles';

export const STORAGE_KEYS = Object.freeze({
  LANGUAGE: 'noorix-lang',
  /** مفتاح قديم (قبل التوحيد) — يُقرأ مرة للهجرة ثم يُزال */
  LANGUAGE_LEGACY: 'noorix:language',
  ACTIVE_COMPANY: 'noorix-active-company',
});

/** مفضلات موردين — دفعات المشتريات */
export const SUPPLIER_BOOKMARKS_KEY = 'noorix_supplier_bookmarks_v1';


/** ترتيب بطاقات تحليل كشف البنك */
export const BANK_ANALYSIS_CARDS_KEY = 'noorix_bank_analysis_cards_v1';

/** تكرار اختيار الموردين في القوائم */
export const SUPPLIER_USAGE_KEY = 'noorix_supplier_usage_v1';

/** بادئة مفتاح مسودة تقرير الضريبة: `${TAX_REPORT_STORAGE_PREFIX}_${companyId}_${period}` */
export const TAX_REPORT_STORAGE_PREFIX = 'noorix_tax_report_v1';

/** كاش عام في الذاكرة/المتصفح */
export const GLOBAL_CACHE_STORAGE_KEY = 'noorix_global_cache_v1';

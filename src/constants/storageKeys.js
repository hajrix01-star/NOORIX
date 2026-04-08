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

/** تنبيهات أسعار OCR — معرفات الصنف المُخفاة */
export const OCR_DISMISSED_ALERTS_KEY = 'noorix-dismissed-alerts';

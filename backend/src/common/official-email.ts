/**
 * النطاق الرسمي لبريد المستخدمين في النظام (إنشاء تلقائي عند إضافة مستخدم بدون بريد يدوي).
 * يجب أن يطابق واجهة الدخول القصير: VITE_OFFICIAL_EMAIL_DOMAIN (نفس القيمة عند بناء الـ frontend).
 */
export const OFFICIAL_EMAIL_DOMAIN = (process.env.OFFICIAL_EMAIL_DOMAIN || 'hajrix.com').toLowerCase().trim();

/** بريد المسؤول الافتراضي — يُستبدل بـ ADMIN_EMAIL من البيئة إن وُجد */
export const DEFAULT_ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL : `admin@${OFFICIAL_EMAIL_DOMAIN}`
).toLowerCase().trim();

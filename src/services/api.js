/**
 * Noorix API layer — واجهة موحدة لاستدعاء الـ Backend.
 * التنفيذ في `core/apiHttp.js` (العميل والـ retry) و`domains/apiEndpoints/` (كل المسارات، barrel `index.js`).
 * الاستيراد من `services/api` يبقى كما هو: `export *` يعيد تصدير كل الدوال.
 */
export * from './core/apiHttp';
export * from './domains/apiEndpoints';

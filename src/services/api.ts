/**
 * Noorix API layer — واجهة موحدة لاستدعاء الـ Backend.
 * التنفيذ في `core/apiHttp.ts` (العميل والـ retry) و`domains/apiEndpoints/` (كل المسارات، barrel `index.ts`).
 * الاستيراد من `services/api` يبقى كما هو: `export *` يعيد تصدير كل الدوال.
 */
export * from './core/apiHttp';
export * from './domains/apiEndpoints';

/**
 * أنواع HTTP موحّدة للواجهة — تتوسّع تدريجياً بدل الاعتماد على `any` في كل استدعاء.
 * القيمة الافتراضية للـ generic تبقى مرنة (`any`) حتى يكتمل تشديد strict على المشروع.
 */
export type ApiParsedResult<TData = any, TItems = any> = {
  success: boolean;
  data?: TData;
  /** بعض الواجهات تُرجع مصفوفة في الجذر بدل `data` */
  items?: TItems;
  /** حقول ترقيم شائعة في جذر الاستجابة (مثل HR employees paged) */
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
  code?: number;
  isTransientServerError?: boolean;
  isNetworkError?: boolean;
};

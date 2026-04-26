/**
 * أنواع HTTP موحّدة للواجهة — تتوسّع تدريجياً بدل الاعتماد على `any` في كل استدعاء.
 * القيمة الافتراضية للـ generic تبقى مرنة (`any`) حتى يكتمل تشديد strict على المشروع.
 */
export type ApiParsedResult<TData = any, TItems = any> = {
  success: boolean;
  data?: TData;
  /** بعض الواجهات تُرجع مصفوفة في الجذر بدل `data` */
  items?: TItems;
  error?: string;
  code?: number;
  isTransientServerError?: boolean;
  isNetworkError?: boolean;
};

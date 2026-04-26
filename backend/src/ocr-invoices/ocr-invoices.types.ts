/**
 * مُرسل طلب save من مسار الاعتماد (صلاحية مشتريات/فواتير).
 */
export type OcrSaveInvoiceCaller = {
  userId: string;
  role?: string;
  permissions?: string[];
};

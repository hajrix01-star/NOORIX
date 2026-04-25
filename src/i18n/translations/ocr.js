/**
 * ترجمات قسم OCR الفواتير
 */
export default {
  ocrTitle:            { ar: 'OCR الفواتير', en: 'Invoice OCR' },
  ocrCashierSubmitNav: { ar: 'إرسال فاتورة (كاشير)', en: 'Submit invoice (cashier)' },
  ocrCashierPageTitle: { ar: 'إرسال فاتورة مورد', en: 'Submit supplier invoice' },
  ocrCashierPageHint: {
    ar: 'يُرسل الطلب للخلفية للاستخراج. ستظهر للمحاسب في «مراجعة الاستخراج» عند الجاهزية.',
    en: 'The request is queued for background extraction. It will appear in extraction review when ready.',
  },
  ocrCashierSentOk: {
    ar: 'تم الإرسال بنجاح — رقم الطلب: {0}',
    en: 'Sent successfully — reference: {0}',
  },
  ocrBeta:             { ar: 'تجريبي', en: 'Beta' },
  ocrUploadTab:        { ar: 'رفع فاتورة', en: 'Upload Invoice' },
  ocrReviewQueueTab:   { ar: 'مراجعة الاستخراج', en: 'Extraction review' },
  ocrRefresh:          { ar: 'تحديث', en: 'Refresh' },
  ocrQueueLoading:     { ar: 'جاري التحميل…', en: 'Loading…' },
  ocrQueueEmpty:       { ar: 'لا توجد طلبات في الطابور.', en: 'No items in the queue.' },
  ocrStatToReview:     { ar: 'للمراجعة', en: 'To review' },
  ocrReviewAction:     { ar: 'مراجعة', en: 'Review' },
  ocrInvoicesTab:      { ar: 'الفواتير', en: 'Invoices' },
  ocrSuppliersTab:     { ar: 'الموردون', en: 'Suppliers' },
  ocrItemsTab:         { ar: 'الأصناف', en: 'Items' },
  ocrPriceAlertsTab:   { ar: 'تنبيهات الأسعار', en: 'Price Alerts' },
  ocrPurchasesReportTab: { ar: 'تقرير مشتريات', en: 'Purchases report' },
  ocrReportMonth:      { ar: 'الشهر', en: 'Month' },
  ocrReportLoad:       { ar: 'عرض التقرير', en: 'Load report' },
  ocrReportLoading:    { ar: 'جاري تحميل التقرير…', en: 'Loading report…' },
  ocrReportEmpty:      { ar: 'لا توجد فواتير OCR في هذا الشهر.', en: 'No OCR invoices in this month.' },
  ocrReportByCategory: { ar: 'حسب الفئة', en: 'By category' },
  ocrReportByItem:     { ar: 'حسب الصنف', en: 'By item' },
  ocrReportInvoices:   { ar: 'الفواتير', en: 'Invoices' },
  ocrReportCategory:   { ar: 'الفئة', en: 'Category' },
  ocrReportLines:      { ar: 'سطور', en: 'Lines' },
  ocrReportTotal:      { ar: 'الإجمالي', en: 'Total' },
  ocrReportItem:       { ar: 'الصنف', en: 'Item' },
  ocrReportQty:        { ar: 'الكمية', en: 'Qty' },
  ocrReportLinked:     { ar: 'مرتبط محاسبياً', en: 'Linked (ledger)' },
  ocrLinkNoorixSupplier: { ar: 'ربط بمورد النظام (محاسبة)', en: 'Link to Noorix supplier' },
  ocrLinkedNoorixHint: {
    ar: 'يُستخدم لاقتراح مورد المحاسبة عند اعتماد فاتورة مشتريات من OCR.',
    en: 'Used to pre-fill accounting supplier when posting a purchase from OCR.',
  },
  ocrSaveSupplierLink: { ar: 'حفظ الربط', en: 'Save link' },
  ocrNoorixLinked:     { ar: 'مربوط:', en: 'Linked:' },

  // Upload
  ocrDragDrop:         { ar: 'اسحب صورة الفاتورة هنا أو اضغط للاختيار', en: 'Drag invoice image here or click to select' },
  ocrSupportedFormats: { ar: 'يدعم: JPG, PNG, WEBP', en: 'Supports: JPG, PNG, WEBP' },
  ocrExtract:          { ar: 'استخراج البيانات', en: 'Extract Data' },
  ocrExtracting:       { ar: 'جاري الاستخراج...', en: 'Extracting...' },
  ocrPrefillLoading:   { ar: 'جاري تحميل فاتورة المراجعة…', en: 'Loading review invoice…' },

  ocrLinkedPurchaseTitle: {
    ar: 'فاتورة مشتريات محاسبية',
    en: 'Accounting purchase invoice',
  },
  ocrLinkedPurchaseHint: {
    ar: 'تاريخ العملية محاسبياً (يُسجَّل في الدفاتر). تاريخ فاتورة المورد يبقى كما في بيانات OCR أعلاه.',
    en: 'Transaction date is for ledger posting. Supplier invoice date stays as in the OCR fields above.',
  },
  ocrCreateLinkedPurchase: { ar: 'إنشاء فاتورة مشتريات وربطها', en: 'Create and link purchase invoice' },
  ocrPurchaseNoPermission: {
    ar: 'لا تملك صلاحية تسجيل مشتريات محاسبية — اعتمد فقط سجل OCR.',
    en: 'You cannot post accounting purchases — save OCR record only.',
  },
  ocrTransactionDate:    { ar: 'تاريخ العملية (محاسبي)', en: 'Transaction date (ledger)' },
  ocrVaultSelect:        { ar: 'الخزنة', en: 'Vault' },
  ocrSelectVault:        { ar: 'اختر الخزنة', en: 'Select vault' },
  ocrSelectAccountingSupplier: { ar: 'اختر مورد المحاسبة', en: 'Select accounting supplier' },
  ocrSupplierInvoiceNo:  { ar: 'رقم فاتورة المورد', en: 'Supplier invoice number' },
  ocrPurchaseTaxable:    { ar: 'خاضعة للضريبة (15%)', en: 'Taxable (15%)' },
  ocrPurchaseSuggestEmpty: {
    ar: 'لا توجد مطابقات تلقائية — اختر من قائمة الموردين في المحاسبة أو أضف مورداً هناك.',
    en: 'No auto-matches — pick an accounting supplier from your catalog or add one there.',
  },
  ocrLinkedPurchaseOpenList: {
    ar: 'فتح قائمة الفواتير (مشتريات) بتاريخ العملية',
    en: 'Open invoices list (purchases) for transaction date',
  },
  ocrPurchaseRecordedLinked: {
    ar: 'تم تسجيل فاتورة المشتريات وربطها.',
    en: 'Purchase invoice recorded and linked.',
  },
  ocrLinkedPurchaseAlready: {
    ar: 'مرتبطة بفاتورة مشتريات محاسبية.',
    en: 'Linked to an accounting purchase invoice.',
  },
  ocrExtractSuccess:   { ar: 'تم الاستخراج بنجاح', en: 'Extracted successfully' },
  ocrExtractFailed:    { ar: 'فشل الاستخراج', en: 'Extraction failed' },
  ocrSaveInvoice:      { ar: 'حفظ الفاتورة', en: 'Save Invoice' },
  ocrSaving:           { ar: 'جاري الحفظ...', en: 'Saving...' },
  ocrSaved:            { ar: 'تم الحفظ بنجاح', en: 'Saved successfully' },
  ocrReset:            { ar: 'بدء من جديد', en: 'Start Over' },

  // Extraction result
  ocrSupplierField:    { ar: 'المورد', en: 'Supplier' },
  ocrVatNumber:        { ar: 'الرقم الضريبي', en: 'VAT Number' },
  ocrInvoiceNumber:    { ar: 'رقم الفاتورة', en: 'Invoice Number' },
  ocrInvoiceDate:      { ar: 'تاريخ الفاتورة', en: 'Invoice Date' },
  ocrTotalAmount:      { ar: 'الإجمالي', en: 'Total' },
  ocrVatAmount:        { ar: 'الضريبة', en: 'VAT' },
  ocrItems:            { ar: 'الأصناف', en: 'Items' },
  ocrItemName:         { ar: 'اسم الصنف', en: 'Item Name' },
  ocrQty:              { ar: 'الكمية', en: 'Qty' },
  ocrUnitPrice:        { ar: 'سعر الوحدة', en: 'Unit Price' },
  ocrTotal:            { ar: 'الإجمالي', en: 'Total' },
  ocrConfidence:       { ar: 'دقة الاستخراج', en: 'Confidence' },

  // Match status
  ocrMatchAuto:        { ar: 'مطابقة تلقائية', en: 'Auto match' },
  ocrMatchReview:      { ar: 'يحتاج مراجعة', en: 'Needs review' },
  ocrMatchNew:         { ar: 'صنف جديد', en: 'New item' },
  ocrMatchedTo:        { ar: 'طابق:', en: 'Matched to:' },

  // Suppliers
  ocrAddSupplier:      { ar: 'إضافة مورد', en: 'Add Supplier' },
  ocrSupplierNameAr:   { ar: 'الاسم بالعربية', en: 'Name (Arabic)' },
  ocrSupplierNameEn:   { ar: 'الاسم بالإنجليزية', en: 'Name (English)' },
  ocrSupplierTax:      { ar: 'الرقم الضريبي', en: 'VAT Number' },
  ocrSupplierPhone:    { ar: 'الهاتف', en: 'Phone' },
  ocrNoSuppliers:      { ar: 'لا يوجد موردون بعد. أضف مورداً لتبدأ.', en: 'No suppliers yet. Add a supplier to start.' },
  ocrInvoiceCount:     { ar: 'فاتورة', en: 'invoice(s)' },
  ocrAliases:          { ar: 'أسماء بديلة', en: 'Aliases' },
  ocrAddAlias:         { ar: 'إضافة اسم بديل', en: 'Add Alias' },

  // Items
  ocrAddItem:          { ar: 'إضافة صنف', en: 'Add Item' },
  ocrItemNameAr:       { ar: 'الاسم بالعربية', en: 'Name (Arabic)' },
  ocrItemNameEn:       { ar: 'الاسم بالإنجليزية', en: 'Name (English)' },
  ocrItemCategory:     { ar: 'الفئة', en: 'Category' },
  ocrItemUnit:         { ar: 'وحدة القياس', en: 'Unit' },
  ocrNoItems:          { ar: 'لا توجد أصناف بعد. أضف صنفاً لتبدأ.', en: 'No items yet. Add an item to start.' },
  ocrPriceHistory:     { ar: 'تاريخ الأسعار', en: 'Price History' },
  ocrLowestPrice:      { ar: 'أقل سعر', en: 'Lowest price' },

  // Price alerts
  ocrNoPriceAlerts:    { ar: 'لا توجد تنبيهات أسعار حالياً.', en: 'No price alerts at this time.' },
  ocrPriceAlert:       { ar: 'سعر مرتفع', en: 'High Price' },
  ocrLatestPrice:      { ar: 'السعر الأخير', en: 'Latest price' },
  ocrBestPrice:        { ar: 'أفضل سعر', en: 'Best price' },
  ocrCheaperSupplier:  { ar: 'مورد أرخص', en: 'Cheaper supplier' },
  ocrPriceIncrease:    { ar: 'أعلى بنسبة', en: 'Higher by' },

  // Invoices list
  ocrNoInvoices:       { ar: 'لا توجد فواتير مستخرجة بعد.', en: 'No extracted invoices yet.' },
  ocrStatusPending:    { ar: 'بانتظار المراجعة', en: 'Pending review' },
  ocrStatusConfirmed:  { ar: 'مؤكدة', en: 'Confirmed' },
  ocrStatusRejected:   { ar: 'مرفوضة', en: 'Rejected' },

  // General
  ocrDelete:           { ar: 'حذف', en: 'Delete' },
  ocrEdit:             { ar: 'تعديل', en: 'Edit' },
  ocrSave:             { ar: 'حفظ', en: 'Save' },
  ocrCancel:           { ar: 'إلغاء', en: 'Cancel' },
  ocrSearch:           { ar: 'بحث...', en: 'Search...' },
  ocrNoGemini:         { ar: 'مفتاح Gemini غير مُعرَّف في الخادم. يرجى إضافة GEMINI_API_KEY في .env', en: 'Gemini API key not configured on server. Please add GEMINI_API_KEY to .env' },
};

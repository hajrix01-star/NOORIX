/**
 * ترجمات قسم OCR الفواتير
 */
export default {
  ocrTitle:            { ar: 'OCR الفواتير', en: 'Invoice OCR' },
  ocrBeta:             { ar: 'تجريبي', en: 'Beta' },
  ocrUploadTab:        { ar: 'رفع فاتورة', en: 'Upload Invoice' },
  ocrInvoicesTab:      { ar: 'الفواتير', en: 'Invoices' },
  ocrSuppliersTab:     { ar: 'الموردون', en: 'Suppliers' },
  ocrItemsTab:         { ar: 'الأصناف', en: 'Items' },
  ocrPriceAlertsTab:   { ar: 'تنبيهات الأسعار', en: 'Price Alerts' },

  // Upload
  ocrDragDrop:         { ar: 'اسحب صورة الفاتورة هنا أو اضغط للاختيار', en: 'Drag invoice image here or click to select' },
  ocrSupportedFormats: { ar: 'يدعم: JPG, PNG, WEBP', en: 'Supports: JPG, PNG, WEBP' },
  ocrExtract:          { ar: 'استخراج البيانات', en: 'Extract Data' },
  ocrExtracting:       { ar: 'جاري الاستخراج...', en: 'Extracting...' },
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

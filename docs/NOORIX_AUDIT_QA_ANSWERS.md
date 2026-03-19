# NOORIX SYSTEM AUDIT & QUALITY ASSURANCE — التعهد التقني

إجابات مراجعة الكود والخطط الحالية. كل نقطة: **(نعم)** أو **(لا)** مع الدليل (ملف/دالة).

---

| # | السؤال | الإجابة | الدليل التقني |
|---|--------|---------|----------------|
| 1 | هل النظام مصمم (عبر PostgreSQL والـ Indexing) لمعالجة أكثر من 100,000 فاتورة دون بطء؟ | **لا** | لا يوجد Backend ولا PostgreSQL ولا schema في المستودع؛ الواجهة فقط (Vite + React). التصميم موثّق في docs/NOORIX_RULES.md (جدول الحركات) لكن غير منفذ. |
| 2 | هل جميع الحسابات المالية تتم عبر Decimal.js لضمان دقة الهللات؟ | **لا** | `src/constants/tax.js`: دالة `splitTax` تستخدم `Number()` و `Math.round()` وليس Decimal.js. أما المبالغ فتُحسب بـ Decimal في `unifiedTransaction.js`, `SalesService.js`, `SalesInvoiceScreen.jsx`. |
| 3 | هل يوجد Foreign Key Constraints يمنع حذف مورد مرتبط بفواتير؟ | **لا** | لا يوجد schema قاعدة بيانات ولا Backend في المشروع؛ لا يمكن التحقق من وجود FK. المواصفات لا تذكر هذا صراحة. |
| 4 | هل جميع الحركات تُسجل آلياً بتوقيت السعودية (UTC+3) بغض النظر عن موقع السيرفر؟ | **لا** | `src/core/unifiedTransaction.js` دالة `buildDualDates`: `entryDate = new Date().toISOString()` (وقت الجهاز/السيرفر بصيغة UTC). لا يوجد تحويل إلى Asia/Riyadh في الكود. القواعد تطلب توقيت السعودية لكن غير مطبّق. |
| 5 | هل تم تطبيق مسافة أمان ثابتة (margin-right: 260px) تمنع تداخل القائمة مع الجداول في الديسكتوب؟ | **لا** | `src/index.css` سطر ~311: القيمة المستخدمة `margin-right: 220px` وليس 260px (تعليق: "يطابق عرض السايدبار الجديد"). |
| 6 | هل كل حركة "حفظ فاتورة" تولد آلياً حركة مقابلة في جدول TreasuryTransactions (القيد المزدوج)؟ | **لا** | التصميم في `unifiedTransaction.js` و `SalesService.js` يفوّض الكتابة إلى `runInTransaction`. التنفيذ الحالي في `SalesInvoiceScreen.jsx` يحفظ في localStorage فقط ولا يكتب إلى جدول ledger/TreasuryTransactions. |
| 7 | هل الكود يمنع جلب أي بيانات (Query) بدون وجود شرط company_id كمرشح إجباري؟ | **لا** | `src/services/api.js`: `getCompanies()` لا يأخذ `companyId`. دوال أخرى (getLedgerEntries, getVaults, getSuppliers) تأخذ companyId كمعامل لكن لا يوجد طبقة (middleware/backend) تمنع استدعاءات بدون company_id. |
| 8 | هل يدعم النظام (Server-side Pagination) لجلب البيانات على دفعات؟ | **لا** | واجهة API في `api.js` تدعم `page` و `pageSize` في `getLedgerEntries` و `getSuppliers`، لكن لا يوجد خادم حقيقي؛ الطلبات mock. التصميم موثّق في docs/PERFORMANCE_AND_DATA.md. |
| 9 | هل تستخدم (Database Transactions) لضمان إلغاء العملية بالكامل عند فشل أي جزء؟ | **لا** | `unifiedTransaction.js` يمرّر `runInTransaction` كـ callback ويُفترض أن طبقة DB تنفّذها؛ لا يوجد Backend ولا DB transactions منفذة. التعليق في الكود يطلب من runInTransaction تنفيذ rollback. |
| 10 | هل يوجد (Unique Constraint) يمنع تكرار إدخال نفس رقم الفاتورة لنفس المورد مرتين؟ | **لا** | لا يوجد schema ولا Backend؛ لا يمكن التحقق. المواصفات لا تذكر هذا القيد صراحة. |
| 11 | هل تستخدم (React Query Caching) لمنع إعادة تحميل البيانات عند التنقل؟ | **لا** | لا يوجد React Query. يُستخدم نظام كاش مخصص: `useDataManager` و `cacheHelper.js` (initGlobalCacheManager, setCache, getCache, invalidateRelated). |
| 12 | هل المكوّن (SmartTable) يفهم تلقائياً تغيير الاتجاه (RTL) دون تعديل يدوي؟ | **لا** | لا يوجد مكوّن باسم SmartTable في المشروع. القواعد تذكر "استخدام checkbox للصفوف وعرض Total و Tax في التذييل" لكن المكوّن غير منفذ. |
| 13 | هل يوجد نظام (Global Error Boundary) يمنع انهيار النظام بالكامل عند خطأ في دالة؟ | **لا** | لا يوجد ErrorBoundary ولا componentDidCatch في `src/App.jsx` أو أي مكوّن في المشروع. |
| 14 | هل يدعم البحث في الجداول (Indexing / Full-text search) للوصول للبيانات في أجزاء من الثانية؟ | **لا** | لا يوجد Backend ولا قاعدة بيانات؛ لا indexing ولا full-text search منفذ. |
| 15 | هل يتم توثيق أي عملية "تعديل" في جدول مستقل (Audit Trail) يوضح القيمة القديمة والجديدة؟ | **لا** | سجل التدقيق (Audit log) موثّق في docs/NOORIX_RULES.md و docs/modules/SETTINGS.md فقط؛ لا تنفيذ في الكود (لا جدول audit ولا تسجيل old/new value). |
| 16 | هل يطبق النظام (Zod/Joi Validation) على مستوى السيرفر لمنع إدخال بيانات خاطئة أو خبيثة؟ | **لا** | لا يوجد Backend ولا استخدام لـ Zod أو Joi في المشروع. التحقق الحالي في الواجهة عبر `validateTransactionPayload` في `unifiedTransaction.js` (قيم مالية وتواريخ وحقول مطلوبة). |
| 17 | هل يوجد نظام (Session Timeout) لطرد المستخدم تلقائياً عند خمول الحساب؟ | **لا** | لا يوجد كود لـ session timeout أو logout تلقائي عند الخمول. المصادقة مذكورة في docs (JWT/session) لكن غير منفذة. |

---

**ملخص:** الإجابات أعلاه تعكس **حالة الكود والخطط الحالية** فقط. الالتزام بتحويل كل النقاط إلى **(نعم)** موثّق في **[docs/NOORIX_EXECUTION_PLAN.md](NOORIX_EXECUTION_PLAN.md)** (خطة العمل الكاملة 17/17) قبل مرحلة التنفيذ (Apply).

*تاريخ المراجعة: 2025-03-12*

# سجل مخاطر أمان ما قبل الإطلاق — npm audit (متبقي)

مرجع للثغرات التي تبقى ظاهرة في `npm audit --omit=dev` (جذر الواجهة) و`npm audit --omit=dev --prefix backend` بعد التخفيفات الآمنة (بدون `npm audit fix --force` وبدون ترقيات major غير مخططة).

**آخر مراجعة:** 2026-04-28

---

| Package / dependency | Location | Vulnerability summary | Severity | Why not fixed now | Current mitigation | Future action | Owner / priority |
|----------------------|----------|------------------------|----------|-------------------|-------------------|---------------|------------------|
| **vite** (≤6.4.1) | root (dev/build) | Path traversal في معالجة الـ `.map` لـ optimized deps — [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) | Moderate | الإصلاح المقترح من npm يرفع **Vite 8** (قفزة major)؛ يتطلب اختباراً واسعاً وخطة إصدار. | الإنتاج يعتمد على `vite build` وليس خادم dev؛ تقليل تعرض dev عبر شبكة موثوقة فقط. | PR مخصص لترقية Vite (وسلسلة Vitest/plugin) مع اختبار كامل للبناء والـ PWA. | **Platform** — P1 |
| **xlsx** | root (`dependencies`) | Prototype pollution و ReDoS في SheetJS — [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6)، [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) | High | لا يوجد إصلاح من الناشر في الإصدار الحالي؛ الاستبدال بمكتبة أخرى يحتاج إعادة كتابة مسارات الاستيراد/التصدير. | **`spreadsheetUploadGuard`**: حد حجم (15MB)، امتدادات مسموحة، تحقق MIME معقول؛ الاستيراد يمر عبر `assertSpreadsheetUploadFile` في `excelExportImport.ts`. | تقييم بديل (مثلاً قراءة سيرفر-سايد أو مكتبة مدعومة أمنياً) في PR منفصل. | **App security** — P0 (تخفيف) / P1 (استبدال) |
| **@nestjs/core** (Nest 10) | backend | تطبيع غير كافٍ لعناصر خرج تُستخدم downstream — [GHSA-36xv-jgw5-4q75](https://github.com/advisories/GHSA-36xv-jgw5-4q75) | Moderate | الإصلاح الكامل يوجّه إلى **Nest 11** (major) مع سلسلة حزم؛ خارج نطاق «patch فقط» قبل الإطلاق. | البقاء على **10.4.22** (آخر patch في السلسلة 10)؛ مراجعة إصدارات Nest الأمنية الدورية. | PR ترقية Nest 11+ مع اختبارات تكامل و regression كاملة. | **Backend** — P1 |
| **file-type** (transitive عبر **@nestjs/common**) | backend | حلقات لا نهائية / DoS في معالجات صيغ معيّنة — [GHSA-5v7r-6r5c-r473](https://github.com/advisories/GHSA-5v7r-6r5c-r473)، [GHSA-j47w-4g3g-c36v](https://github.com/advisories/GHSA-j47w-4g3g-c36v) | Moderate | `npm audit fix` يقترح **@nestjs/common@11**؛ override لـ `file-type` دون اختبار قد يكسر توافق Nest. | عدم تمرير ملفات غير موثوقة إلى مسارات `file-type` داخل التطبيق؛ الاعتماد على حدود الرفع في الـ API حيث ينطبق. | بعد ترقية Nest أو عند توفر نطاق `@nestjs/common` يثبت `file-type` ≥ 22.x آمن. | **Backend** — P2 |
| **uuid** (transitive عبر **bull**) | backend | فحص حدود buffer ناقص في مسارات v3/v5/v6 عند تمرير `buf` — [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Moderate | الإصلاح يقترح سلسلة ترفع **@nestjs/schedule@6** وuuid أحدث؛ يتطلب توافق Bull واختبار طوابير. | Bull يُستخدم في مسارات معروفة؛ مراقبة إصدارات `bull` و`uuid`؛ لا تمرير `buf` غير موثوق من تطبيقنا إلى واجهات uuid. | PR ترقية منسّقة لـ Bull + uuid + Nest schedule بعد قراءة changelogs. | **Backend** — P2 |

---

## ملاحظات تشغيلية

- **لا** تشغيل `npm audit fix --force` قبل الإطلاق دون موافقة صريحة وخطة rollback.
- إعادة تشغيل `npm audit --omit=dev` و`npm audit --omit=dev --prefix backend` بعد أي تغيير على `package.json` أو القفل.
- ربط هذا السجل بـ [REPOSITORY_MAINTENANCE_RUNBOOK.md](./REPOSITORY_MAINTENANCE_RUNBOOK.md) (قسم الصيانة والتبعيات).

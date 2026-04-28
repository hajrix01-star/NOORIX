# Reporting source of truth (Noorix)

هذا المستند يحدد **المصدر الرسمي** لكل مؤشر أو رقم يُعرض في لوحات التحكم والتقارير، لتجنب احتساب نفس المقياس بثلاث طرق في أماكن مختلفة.  
**القاعدة:** الواجهة تعرض فقط ما يعيده الـ API / الخدمة؛ التقارير الرسمية (P&L، الضريبة، إلخ) تبقى مصدر الحقيقة للأرقام المحاسبية/الضريبية.

| KPI / Metric | Official source | Service / endpoint (concept) | Type | Used in (UI) | Notes |
|--------------|-----------------|------------------------------|------|--------------|--------|
| P&L sales, purchases, expenses, gross/net profit (year or by month) | General P&L report | `GET` general profit & loss report | Accounting / report | Dashboard overview, Reports P&L, Owner dashboard (aggregated) | نفس الـ payload للسنة؛ Owner يجمع عدة شركات في الواجهة فقط. |
| Sales timeline (monthly / daily) | Sales summaries (pack) | `getDashboardSalesPack` / sales summaries | Operational | Dashboard overview | حزمة واحدة للسنة/اليوم/الشهر لتحسين الأداء. |
| Top suppliers, purchase by category, period purchase total | Period analytics | `GET` period analytics | Operational / analytic | Dashboard overview | نطاق التواريخ = فلتر الفترة في الداشبورد. |
| Sales by channel (pie) | Channel breakdown داخل ملخصات المبيعات | نفس حزمة المبيعات | Operational | Dashboard overview | |
| Owner — company P&L | Same as P&L report per company | Same report endpoint per `companyId` | Accounting | Owner dashboard | استعلامات متوازية مع مفتاح `owner` في React Query. |
| Owner — daily sales curve | Daily sales summaries | Daily sales API (paginated في الهوك) | Operational | Owner dashboard (daily grain) | |
| Vault balances | Vault / ledger | Vault APIs | Financial | Treasury, (references elsewhere) | لا يُعاد حساب الرصيد في الواجهة من ملخصات عشوائية. |
| VAT / tax report rows | Tax VAT report | Tax VAT report endpoint | Tax | Reports → Tax | مصدر ضريبي رسمي؛ لا يُستبدل بحساب الواجهة. |
| Hajri tax disclosure | Hajri tax modules | Dedicated Hajri endpoints | Tax / compliance | Hajri Tax screens | معزول عن تقرير الضريبة العادي؛ لا يدمج هنا. |
| Bank reconciliation / categorization | Bank statement analysis | Bank statement services | Control / operational | Bank statement reports | |
| OCR pipeline status | OCR services | OCR endpoints | Operational | OCR module only | لا يُضاف كـ KPI للداشبورد العام في هذا الإصدار. |

## مفاتيح React Query والإبطال المالي

- **مصانع المفاتيح:** `src/services/queryKeys/` — استخدمها في الاستعلامات بدل تكرار السلاسل يدويًا.
- **إبطال واسع بعد عمليات مالية:** `src/utils/queryInvalidation.ts` (`invalidateOnFinancialMutation`) يستدعي دوال بادئة من المصانع (`*Root()` وما شابه)؛ راجع **`docs/REACT_QUERY_KEYS_GUIDE.md`** قبل إضافة بادئات جديدة.

## قواعد التطوير اللاحق (Owner BI / Analytics)

- **Analytics Engine** (عند بنائه لاحقًا) يقرأ من المصادر أعلاه عبر APIs؛ لا يُنشئ أرقامًا محاسبية من الصفر في الواجهة.
- إذا ظهر **نفس الاسم** لمقياسين من مصدرين مختلفين (مثلاً «مبيعات» تشغيلية vs تقرير)، يجب تمييزهما في الواجهة أو في التوثيق تحت Notes.

## تغيير هذا الملف

يُحدَّث مع إضافة مصادر KPI جديدة أو عند تغيير عقد API للتقارير؛ لا يُعد بديلاً عن عقود الـ OpenAPI/الـ backend.

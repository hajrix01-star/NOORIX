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
| Vault balances | Vault / ledger | Vault APIs | Financial | Treasury, (references elsewhere) | لا يُعاد حساب الرصيد في الواجهة من ملخصات عشوائية. انظر قسم **Vault balances — three different meanings** أدناه. |
| VAT / tax report rows | Tax VAT report | Tax VAT report endpoint | Tax | Reports → Tax | مصدر ضريبي رسمي؛ لا يُستبدل بحساب الواجهة. مساعدات عرض نموذج الإفصاح: انظر **Tax disclosure UI helpers**. |
| Hajri tax disclosure | Hajri tax modules | Dedicated Hajri endpoints | Tax / compliance | Hajri Tax screens | معزول عن تقرير الضريبة العادي؛ لا يدمج هنا. يعيد استخدام مساعدات الإفصاح للعرض فقط — انظر **Tax disclosure UI helpers**. |
| Bank reconciliation / categorization | Bank statement analysis | Bank statement services | Control / operational | Bank statement reports | |
| OCR pipeline status | OCR services | OCR endpoints | Operational | OCR module only | لا يُضاف كـ KPI للداشبورد العام في هذا الإصدار. |
| Dashboard insights (deterministic) | Insights on composed reporting reads | `GET /api/v1/reporting/insights/dashboard` | Derived / read-only | *(no frontend consumer yet)* | يعتمد على نفس مدخلات ملخص الداشبورد عبر الطبقات الداخلية؛ لا يستبدل أرقام الـ KPI الرسمية. انظر **Reporting Insights Layer**. |

## Operational vs Accounting Metrics

- **P&L** is **ledger-based** (official accounting view for profit & loss).
- **Period analytics** is **invoice-based** (aggregates on invoice totals for the selected date range).
- **Dashboard sales pack** is **`DailySalesSummary`-based** (operational daily sales summaries and channel breakdowns).

These layers **may intentionally differ** (e.g. timing, classification, or grain). They **must not be force-aligned** in code or documentation without an explicit **business / accounting decision**.

## Reporting Facade Layer

Following Phase 1 (wrapper) and Phase 2 (parity tests), **`ReportingFacade`** is documented here as the internal composition point for reporting reads — **without** replacing official KPI sources above until migration work explicitly switches callers.

1. **Location:** `backend/src/reporting/reporting.facade.ts`

2. **Current status**
   - Internal Nest provider only (`ReportingModule` registers it).
   - **No dedicated REST route for `ReportingFacade` itself** — it is invoked by internal services (e.g. **`DashboardInsightsService`**). The read-only route **`GET /api/v1/reporting/insights/dashboard`** returns **derived** insight JSON and does not replace existing P&L / period analytics / sales-pack API contracts; see **Reporting Insights Layer**.
   - **No** direct frontend use of **`ReportingFacade`** yet.
   - **No** change to official REST payloads for P&L, period analytics, or sales pack — the facade is not a drop-in replacement for those responses.

3. **Purpose**
   - Central wrapper around **existing** reporting-related services.
   - Delegates to **`ReportsService`** and **`SalesService`** (same methods the app already uses elsewhere).
   - Does **not** own formulas, SQL, or ledger/VAT rules.
   - Does **not** change P&L, VAT, dashboard, or period analytics **calculations** — it calls the same service methods.

4. **Current methods**
   - `getProfitLossReport(companyId, year)`
   - `getVatReport(companyId, year, period, salesAmountIncludesVat?)`
   - `getDashboardSummary(companyId, dateRange)` — composes P&L, dashboard sales pack, and period analytics results in one object (inputs match existing service signatures).

5. **Testing**
   - Parity unit tests: `backend/src/reporting/reporting.facade.spec.ts`
   - Tests verify **delegation** (correct arguments) and **no nested transformation** of service outputs.

6. **Rule for future migration**
   - Any Dashboard / Reports migration that routes reads through **`ReportingFacade`** must **pass** the facade parity tests **before** replacing existing callers, so behaviour stays aligned with today’s services.

## Reporting Insights Layer

Deterministic **business insights** sit conceptually **above** reporting reads (via **`ReportingFacade`**) and **below** any future BI/analytics products. They interpret numbers already produced elsewhere — they are **not** a second ledger.

1. **DashboardInsightsService (internal)**  
   - Path: `backend/src/reporting/insights/dashboard-insights.service.ts` — Nest service only; orchestrates reads via **`ReportingFacade`**.

2. **Read-only HTTP endpoint**  
   - **`GET /api/v1/reporting/insights/dashboard`** — implemented on **`backend/src/reporting/reporting.controller.ts`** (global prefix **`api/v1`**).

3. **Endpoint behaviour**
   - Delegates to **`DashboardInsightsService.buildDashboardInsights`** (controller does not compute financial figures).
   - Does **not** change financial **calculations** at the source (P&L, sales pack, period analytics logic stays in existing services).
   - Does **not** transform or remap nested **financial source payloads** from upstream services — the HTTP response is the **insights envelope** only (deterministic derived JSON).
   - Returns **deterministic insight output** only (e.g. metrics copy, ratios, health band, warning items).

4. **Endpoint security**
   - **JWT** required.
   - **`CompanyAccessGuard`** required.
   - **`RolesGuard`** required.
   - Permission: **`REPORTS_READ`**.

5. **Query inputs** (same shape as **`ReportingFacade.getDashboardSummary`** / dashboard summary date range)
   - `companyId`
   - `year`
   - `yearStart` / `yearEnd`
   - `dailyStart` / `dailyEnd`
   - `monthStart` / `monthEnd`
   - `periodStart` / `periodEnd`
   - `selectedMonth`
   - `includeCancelledSales`

6. **Current frontend status**
   - **No** frontend hook dedicated to this endpoint yet.
   - Dashboard **does not** display insights yet.
   - Existing Dashboard KPIs/charts **still** use **current** data sources and endpoints (unchanged).

7. **Integration rule**
   - Next step should be a **frontend service/hook only**.
   - Dashboard UI **should not** be changed until that hook is **reviewed**.
   - Insights display **must** be **additive only** and **must not** replace existing KPIs/charts.

### Current v1 rules (identifiers)

- `purchase_ratio_to_sales`
- `expense_ratio_to_sales`
- `net_profit_margin`
- `negative_profit_warning`

**Disabled in v1 (not emitted):** operational daily-sales **missing-data** alerts (`missing_sales_data_warning` exists as code in `insights.rules.ts` but **`DashboardInsightsService` does not push it**). Current NOORIX usage treats **accounting P&L revenue** as the source of truth for sales; operational daily sales summaries are optional and warning users about “missing” operational rows would be misleading. If daily summaries become a required workflow, this rule may be re-enabled.

### Exclusions in v1

- VAT / tax insights
- Payroll insights
- Vault/bank detailed insights
- OCR insights
- Owner BI
- Analytics Studio
- AI/LLM analysis

### Purpose (unchanged)

- Converts reporting numbers into **deterministic** business insights (messages and ratios).
- Reads from **`ReportingFacade`** only (composed reporting reads).
- Does **not** own accounting formulas or ledger/VAT SQL.
- Does **not** change P&L, VAT, dashboard pipelines, Reports, invoices, bank, vaults, payroll, or tax **calculations** at the source.

### Testing

- Unit tests: `backend/src/reporting/insights/dashboard-insights.service.spec.ts`
- Controller delegation tests: `backend/src/reporting/reporting.controller.spec.ts`
- Uses **mocked** `ReportingFacade` / service where applicable; **no** database required for these unit tests.

## Vault balances — three different meanings

The vault APIs expose **more than one notion of “balance”**. Use the correct backend source for each question.

1. **Vault lifetime / current balance**  
   - **Source:** `VaultsService.findAll` **without** `startDate` / `endDate`.  
   - **Meaning:** Cumulative ledger balance from **all** active ledger entries (full history in the aggregation).

2. **Vault period net movement**  
   - **Source:** `VaultsService.findAll` **with** `startDate` / `endDate`.  
   - **Meaning:** Debit minus credit for ledger movements **within** the selected window only — **not** the same as a period closing balance unless product defines it that way; it is **net activity in the period**.

3. **Vault balance as of date**  
   - **Source:** `VaultsService.getBalancesAsOf(companyId, endDate)`.  
   - **Meaning:** Balance **up to end of** the selected date (documented in code as end-of-day style cutoff for that flow).

4. **Vault detail header balance**  
   - **Source:** `findOneWithTransactions` — `debitAgg` / `creditAgg` aggregates.  
   - **Meaning:** **Lifetime** balance for the vault account, while the **transaction list** on the same screen may be **date-filtered** independently.

## Tax disclosure UI helpers

For the **tax disclosure worksheet** (import from system + editable grid), presentation logic and derived totals are implemented in:

- **`src/constants/taxDisclosure.ts`**

Relevant helpers include (among others):

- `computeOutputTotal`
- `computeInputTotal`
- `mergeImportedDisclosure`

**Reports → Tax** uses these helpers for table presentation and totals after merging imported VAT API data with stored disclosure rows.

**`HajriTaxScreen`** also reuses the **same disclosure helpers** for **presentation / table logic** only (shared patterns for the disclosure-style grid). This documents reuse only — **it does not imply any change to Hajri Tax** behaviour or ownership.

Official VAT figures for import remain from the **Tax VAT report** backend endpoint; helpers operate on the disclosure structure shown in the UI.

## Ledger-first reports migration note

The current Ledger-first report migration plan is tracked in **`docs/NOORIX_LEDGER_FIRST_REPORTS_PLAN.md`**.

- P&L totals remain ledger-based.
- VAT disclosure calculation is centralized in `TaxVatCoreService`.
- VAT is intentionally not ledger-only yet; switching it requires VAT output/input account taxonomy and historical-period reconciliation.

## Financial Display Formatting Rules

These rules describe **how amounts should appear** in executive-facing surfaces. They are **policy for documentation and UI consistency**, not a mandate to alter stored data or APIs.

1. **Executive reporting display rule**  
   All financial amounts shown in dashboards, summaries, charts, KPI cards, and printable **executive** reports must be displayed as **whole numbers only** (no decimal places).

2. **Rounding method**  
   **Standard rounding:** values ≥ 0.5 round up, < 0.5 round down — applies to **both** positive and negative numbers when formatting for display.

3. **Scope (where this applies)**  
   - Dashboard  
   - Reports (**non-tax**)  
   - Charts  
   - KPI cards  
   - Executive PDF / print views  

4. **Exclusions (where this does not apply)**  
   - VAT / tax reports  
   - Invoice detail views  
   - Payroll calculations  
   - Bank / vault **transaction** detail lines  
   - Raw exports (accounting / Excel and similar)  

5. **Important rule**  
   This is **display-only**. It **must not** affect:

   - Stored values  
   - API responses  
   - Ledger entries  
   - Financial calculations  
   - VAT logic  

6. **Implementation note**  
   Formatting should be applied at the **presentation layer** only. Backend values remain unchanged.

## مفاتيح React Query والإبطال المالي

- **مصانع المفاتيح:** `src/services/queryKeys/` — استخدمها في الاستعلامات بدل تكرار السلاسل يدويًا.
- **إبطال واسع بعد عمليات مالية:** `src/utils/queryInvalidation.ts` (`invalidateOnFinancialMutation`) يستدعي دوال بادئة من المصانع (`*Root()` وما شابه)؛ راجع **`docs/REACT_QUERY_KEYS_GUIDE.md`** قبل إضافة بادئات جديدة.

## قواعد التطوير اللاحق (Owner BI / Analytics)

- **Analytics Engine** (عند بنائه لاحقًا) يقرأ من المصادر أعلاه عبر APIs؛ لا يُنشئ أرقامًا محاسبية من الصفر في الواجهة.
- إذا ظهر **نفس الاسم** لمقياسين من مصدرين مختلفين (مثلاً «مبيعات» تشغيلية vs تقرير)، يجب تمييزهما في الواجهة أو في التوثيق تحت Notes.

## تغيير هذا الملف

يُحدَّث مع إضافة مصادر KPI جديدة أو عند تغيير عقد API للتقارير؛ لا يُعد بديلاً عن عقود الـ OpenAPI/الـ backend.

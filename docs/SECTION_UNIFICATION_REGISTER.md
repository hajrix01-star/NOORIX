# Section Unification Register

Last updated: 2026-07-07

This register tracks every section that has been closed through the deep section-by-section cleanup process. Its purpose is to avoid losing unification decisions before the final system-wide unification phase.

## Closure Standard

A section is considered closed only when all of the following are true:

- Frontend and backend scope has been reviewed together.
- Frontend/backend contracts are centralized or explicitly documented.
- Table, filter, date, print, and responsive rules are covered by the relevant governance checks.
- Real `any`, unjustified casts, `TODO`, `FIXME`, `ts-ignore`, and `eslint-disable` are removed from the closed section scope, except for documented false positives.
- Financial/accounting numbers are sourced from backend or central models, with no hidden frontend fallback for official figures.
- Tests and governance checks pass before closure.
- A local commit exists for the section closure.

## Closed Sections

| Section | Closure commit | Status | Notes |
| --- | --- | --- | --- |
| Invoices | `485ce7e6 finalize invoice section cleanup` | Closed | Centralized list contracts, export/actions, display models, cash/day-close models, backend invoice contracts, vault display fallback. |
| Purchases | `f3e600a0 finalize purchases section cleanup` | Closed | Centralized batch query contract, batch state/actions/data split, guarded editable/print surfaces, purchase batch display/action/number models. |
| Dashboard | `796a2557 finalize dashboard section cleanup` | Closed | Centralized period contracts, reporting/dashboard contracts, backend-derived metrics, calendar/special-days models, KPI/chart display helpers. |
| Owner Dashboard | 3ecfc325 | Closed | Rebuilt official owner overview model in backend; frontend is display-only for KPIs, charts, comparison, and exports. |
| Sales | `cb1aed9f finalize sales section cleanup` | Closed | Centralized sales API contracts, backend official list/day/page model, typed hooks/actions, removed legacy shift fallback and dead edit modal. |
| HR | `18e71122 finalize hr section cleanup` | Closed | Centralized HR/employee contracts, payroll salary snapshots, typed tabs/modals/actions, backend payroll/settlement guards, strict HR governance. |
| Reports | `48dba7ea finalize reports section cleanup` | Closed | Centralized reports query contract, typed P&L/tax/bank/cost/detail boundaries, print/export/model split, strict reports governance across `src/modules/Reports`. |
| Vaults | `bd73bc55 finalize vaults section cleanup` | Closed | Centralized vault API contracts, treasury display models, typed vault hooks/components, backend period totals, safe deletion guard, strict vaults governance. |
| Expenses | `4046f04e finalize expenses section cleanup` | Closed | Centralized expense API contracts, frontend display/draft models, backend official payment summaries, fixed/variable payment guards, strict expenses governance. |
| Assets Register | `4fae199e finalize assets register section cleanup` | Closed | Centralized asset API contracts, asset form/warranty models, backend filtered acquisition summaries, typed warranty queue, strict assets governance. |

## Invoices

### Centralized

- List filter and query shaping:
  - `src/modules/Invoices/invoicesListFilterModel.ts`
  - `src/modules/Invoices/invoicesListQueryModel.ts`
  - `src/services/domains/apiEndpoints/invoice-list-query.ts`
  - `backend/src/invoice/invoice-list-query-contract.util.ts`
  - `backend/src/invoice/invoice-list-query-parts.util.ts`
- URL drilldown and import/export flow:
  - `src/modules/Invoices/invoicesListUrlModel.ts`
  - `src/modules/Invoices/invoicesListImportExportModel.ts`
  - `src/modules/Invoices/invoicesListExportModel.ts`
- Display and screen models:
  - `src/modules/Invoices/invoiceTableRowModel.ts`
  - `src/modules/Invoices/invoiceViewModel.ts`
  - `src/modules/Invoices/invoiceEditModel.ts`
  - `src/modules/Invoices/invoiceExecutiveCardsModel.ts`
  - `src/modules/Invoices/invoicesCashReportModel.ts`
  - `src/modules/Invoices/dayCloseReportModel.ts`
- Shared touched utilities:
  - `src/utils/vaultDisplay.ts`
  - `src/components/common/InvoiceActionsCell.tsx`
  - `src/components/common/SupplierSelect.tsx`
- Backend invoice safety utilities:
  - invoice date, list, kind, tax, outflow, deduplication, audit/update helpers.

### Protected Exceptions

- Print and day-close report rendering remains section-owned because it is financial and layout-sensitive.
- Some invoice summary cards remain visually section-specific until the final system card/KPI unification pass.

### Final System Unification Candidates

- Convert invoice executive card surfaces to the future central financial KPI/card primitive.
- Review invoice print builders when the system-wide print/export layer is unified.

### Closure Checks

- Frontend invoice tests passed.
- Backend invoice tests passed.
- Typecheck passed at closure.
- `check:invoices-governance`, `check:table-governance`, `check:filter-governance`, and `check:date-control-governance` passed.

## Purchases

### Centralized

- Batch query contract:
  - `src/services/domains/apiEndpoints/purchase-batch-query.ts`
  - `backend/src/invoice/dto/purchase-batch-summaries-query.dto.ts`
  - `backend/src/invoice/purchase-batch-summaries-query-contract.util.ts`
- Batch workflow split:
  - `src/modules/Purchases/batch/hooks/usePurchasesBatchData.ts`
  - `src/modules/Purchases/batch/hooks/usePurchasesBatchState.ts`
  - `src/modules/Purchases/batch/hooks/usePurchasesBatchActions.ts`
- Batch display/action/number models:
  - `src/modules/Purchases/batch/purchaseBatchDisplayModel.ts`
  - `src/modules/Purchases/batch/purchaseBatchActionModel.ts`
  - `src/modules/Purchases/batch/purchaseBatchNumberModel.ts`
  - `src/modules/Purchases/utils/batchRowModel.ts`
- UI decomposition:
  - filters, header, toolbar, table, summary, modals, row parts, edit panel, print sheet.

### Protected Exceptions

- Editable batch-entry grid is protected because it is a financial data-entry surface with row-level controls.
- Purchase print sheet remains section-owned until the final print/export unification pass.

### Final System Unification Candidates

- Move purchase summary bar to the future central summary/KPI primitive.
- Revisit editable purchase table after a dedicated editable-grid design standard exists.

### Closure Checks

- Frontend purchases tests passed.
- Backend purchase-batch contract tests passed.
- Typecheck passed at closure.
- `check:purchases-governance`, `check:table-governance`, `check:filter-governance`, and `check:date-control-governance` passed.

## Dashboard

### Centralized

- Period and API query contract:
  - `src/modules/Dashboard/dashboardPeriodModel.ts`
  - `src/services/domains/apiEndpoints/dashboard-period-query.ts`
  - `backend/src/common/dto/dashboard-period-query.dto.ts`
- Dashboard API contracts and response types:
  - `src/types/api/domains/dashboard.ts`
  - `src/hooks/useDashboardOverview.ts`
  - `src/hooks/useDashboardSalesPack.ts`
  - `src/hooks/useDashboardCalendarData.ts`
  - `src/hooks/useDashboardYearSpecialDays.ts`
- Backend dashboard/reporting logic:
  - `backend/src/dashboard/dashboard.service.ts`
  - `backend/src/dashboard/dashboard-calendar-contracts.ts`
  - `backend/src/dashboard/dashboard-special-days.util.ts`
  - `backend/src/reporting/reporting.facade.ts`
  - `backend/src/reporting/insights/**`
  - `backend/src/reports/reports-pl-invoice-detail.util.ts`
  - `backend/src/sales/sales.service.ts`
- Dashboard display and number models:
  - `src/modules/Dashboard/utils/dashboardNumberModel.ts`
  - `src/modules/Dashboard/utils/dashboardDisplayName.ts`
  - `src/modules/Dashboard/utils/dashboardSpecialDaysModel.ts`
  - `src/modules/Dashboard/utils/dashboardAppSalesData.ts`
  - `src/modules/Dashboard/overview/hooks/useDashboardOverviewModel.ts`
- Calendar and special days:
  - backend contracts for month calendar rows.
  - frontend calendar tab hooks and panel models.
  - Saudi occasions import and special-day split logic.

### Accounting and Metrics Rules

- Dashboard cards and reports must treat sales/purchase/revenue figures as VAT-inclusive where the system report is based on VAT-inclusive totals.
- Heavy metrics and period aggregations are backend-derived where practical.
- Frontend may perform presentation-only shaping such as labels, chart rows, visible deltas, and UI composition.
- No frontend fallback should invent official accounting values if the backend source is unavailable.

### Protected Exceptions

- Some Dashboard chart/table presentation remains frontend-owned because it is view composition, not accounting source-of-truth calculation.
- Calendar print matrix remains protected through the central print-table builder due dynamic day coloring and print layout requirements.
- Dashboard KPI/card visuals are still section-specific until the final system visual unification pass.

### Final System Unification Candidates

- Extract a dedicated backend dashboard metrics service if more dashboard formulas are moved out of `SalesService`.
- Create a central financial KPI/card primitive and migrate Dashboard, Invoices, and Purchases summary surfaces to it.
- Create a central chart empty/loading/error pattern for dashboard-like analytical views.

### Closure Checks

- `npm run typecheck` passed.
- Frontend Dashboard tests passed: 12 files, 57 tests.
- Backend Dashboard/Reporting tests passed: 7 suites, 27 tests.
- `check:dashboard-governance`, `check:table-governance`, `check:filter-governance`, `check:date-control-governance`, and `check:responsive-governance` passed.
- `audit:large-files` still reports existing large files, including Dashboard model/hook files. These are tracked as future architecture candidates, not blockers for this section closure.

## Owner Dashboard

### Centralized

- Official backend overview model:
  - `backend/src/owner/owner-overview-model.util.ts`
  - `backend/src/owner/owner.service.ts`
  - `backend/src/owner/owner.controller.ts`
- Frontend API contract:
  - `src/types/api/domains/owner.ts`
  - `src/services/domains/apiEndpoints/owner-overview.ts`
  - `src/hooks/useOwnerOverview.ts`
  - `src/services/queryKeys/owner.ts`
- Frontend display-only models:
  - `src/modules/Owner/utils/ownerDashboardDisplay.ts`
  - `src/modules/Owner/utils/ownerDashboardExportRows.ts`
  - `src/modules/Owner/hooks/useOwnerDashboardData.ts`
  - `src/modules/Owner/hooks/useOwnerDashboardFilters.ts`
  - `src/modules/Owner/hooks/useOwnerDashboardExports.ts`
- UI surfaces:
  - `src/modules/Owner/components/OwnerKpiCards.tsx`
  - `src/modules/Owner/components/OwnerPerformanceChart.tsx`
  - `src/modules/Owner/components/OwnerMonthlyComparisonTable.tsx`
  - `src/modules/Owner/components/OwnerFilterBar.tsx`

### Accounting and Metrics Rules

- Owner Dashboard official values are built in the backend owner overview model.
- Frontend does not aggregate sales, purchases, expenses, net profit, daily sales, monthly totals, or ratios.
- Frontend export rows use backend-provided official values and ratios; it only formats numbers for Excel/PDF.
- The owner endpoint permission is aligned with the owner route permission: `VIEW_OWNER`.
- Legacy frontend calculation paths were removed:
  - `src/modules/Owner/utils/ownerDashboardCalculations.ts`
  - `src/hooks/useOwnerReports.ts`
  - `src/hooks/useOwnerDailySales.ts`

### Protected Exceptions

- Owner chart and table layout remain section-owned until the final system chart/table visual unification pass.
- Chart tooltip formatting remains frontend-owned because it is display-only.
- Company visibility selection remains frontend state because it controls view filtering, not official accounting values.

### Final System Unification Candidates

- Migrate owner KPI cards to the future central financial KPI/card primitive.
- Migrate owner analytical chart states to the future central chart state primitive.
- Consider moving owner export layout into a future central financial export layer once more report exports are unified.

### Closure Checks

- `npm run typecheck` passed.
- Frontend Owner tests passed: 2 files, 4 tests.
- Backend Owner model/service/controller tests passed: 2 suites, 6 tests.
- `check:owner-governance`, `check:table-governance`, `check:filter-governance`, `check:date-control-governance`, and `check:responsive-governance` passed.

## Sales

### Centralized

- Frontend API contract:
  - `src/types/api/domains/sales.ts`
  - `src/services/domains/apiEndpoints/sales-summaries.ts`
  - `src/services/domains/apiEndpoints/sales-summaries-batch.ts`
  - `src/hooks/useSales.ts`
  - `src/hooks/useSalesChannels.ts`
  - `src/services/queryKeys/sales.ts`
- Backend official list and day model:
  - `backend/src/sales/sales-summary-list-model.util.ts`
  - `backend/src/sales/sales.service.ts`
  - `backend/src/sales/sales.controller.ts`
- Frontend display and action surfaces:
  - `src/modules/Sales/hooks/useDailySalesScreen.ts`
  - `src/modules/Sales/DailySalesScreen.tsx`
  - `src/components/common/SalesActionsCell.tsx`
  - `src/modules/Sales/components/SalesDayEditModal.tsx`
  - `src/modules/Sales/components/SalesEntryModal.tsx`
  - `src/modules/Sales/components/SalesDailyWhatsAppReportBar.tsx`
- Sales shift, input, and report utilities:
  - `src/modules/Sales/constants/salesShift.ts`
  - `src/modules/Sales/constants/salesShiftEntry.ts`
  - `src/modules/Sales/utils/salesApiPayload.ts`
  - `src/modules/Sales/utils/suggestSalesEntryDate.ts`
  - `src/modules/Sales/utils/salesDayShiftReport.ts`
  - `src/modules/Sales/utils/salesWhatsAppChannels.ts`

### Accounting and Metrics Rules

- Official sales list rows, day rows, page totals, customer totals, cash-on-hand totals, and average per customer are built by the backend sales list model.
- Frontend no longer groups daily sales rows or recalculates official list/page totals.
- Frontend rejects incomplete sales list responses instead of fabricating zero page totals.
- Batch sales save uses the official backend `summary-batch` contract without legacy sequential fallback.
- Create/update payloads are normalized through the sales API payload model; backend FinancialCore remains the source of persisted inflow accounting.
- Legacy shift fallback path was removed; `shift` is now part of the official sales contract.
- Entry-card calculations are draft input previews only; persisted official numbers are produced by backend/FinancialCore/list model after save.

### Protected Exceptions

- WhatsApp text assembly remains frontend-owned because it is presentation/share text; it uses typed sales summaries and is guarded by sales governance.
- Sales entry draft preview remains frontend-owned until a future system-wide draft-calculation primitive exists.
- Import/export modal integration remains shared infrastructure; Sales only provides typed fetcher and payload contracts.

### Final System Unification Candidates

- Promote sales entry draft preview to a shared financial draft model if other entry sections need the same pattern.
- Move WhatsApp/report text builders into a central share/reporting layer if more sections adopt WhatsApp summaries.
- Revisit Dashboard app-share/reporting overlap after all sales-dependent sections are closed.

### Closure Checks

- `npm run typecheck` passed.
- Frontend Sales tests passed: 10 files, 39 tests.
- Backend Sales list model tests passed: 1 suite, 2 tests.
- `check:sales-governance`, `check:table-governance`, `check:filter-governance`, `check:date-control-governance`, and `check:responsive-governance` passed.

## HR

### Centralized

- Frontend API and domain contracts:
  - `src/types/api/domains/hr.ts`
  - `src/services/domains/apiEndpoints/hr-query.ts` (`companyQuery`, `companyEmployeeQuery`, `companyEmployeeYearQuery`, `companyEmployeeIdsQuery`, `companyPayrollMonthQuery`, delete query helpers, paged employee normalization)
  - `src/services/domains/apiEndpoints/hr.ts`
  - `src/services/domains/apiEndpoints/employees.ts`
  - `src/hooks/useEmployees.ts`
  - `src/utils/employeeDisplayName.ts`
- Backend HR and employee contracts:
  - `backend/src/hr/hr-query-contract.util.ts`
  - `backend/src/employees/employee-list-query-contract.util.ts`
  - `backend/src/hr/hr-compensation-snapshot.service.ts`
  - `backend/src/hr/hr.service.ts`
  - `backend/src/employees/employees.service.ts`
- Payroll and salary model boundaries:
  - `packages/finance-core/src/hr-salary-engine.ts`
  - `packages/finance-core/src/hr-eos-engine.ts`
  - `backend/src/hr/utils/employee-salary-package.util.ts`
  - `backend/src/hr/utils/leave-salary-settlement.util.ts`
  - `src/modules/HR/utils/hrCalculations/**`
  - `src/modules/HR/tabs/payrollTabModel.ts`
  - `src/modules/HR/tabs/salaryCalcPrint.ts`
  - `src/modules/HR/components/terminationSettlementHelpers.ts`
- Frontend HR tabs, modals, and profile sections:
  - Staff list, employee profile, payroll, advances, leave, residency, EOS, salary, print documents.
  - Payroll run form/detail, quick entry sheet, action cells, document builders, and profile sub-sections.
  - `src/modules/HR/staffListDataOps.ts` owns staff export rows and custom-allowance synchronization outside the screen.
- Governance:
  - `scripts/check-hr-governance.mjs` now blocks real `any`, `as any`, `Record<string, any>`, `as unknown`, `as never`, `TODO`, `FIXME`, `ts-ignore`, and `eslint-disable` in HR closure scope.

### Accounting and Operational Rules

- Official salary package totals come from backend compensation snapshots and shared finance-core HR salary formulas.
- Payroll line/run totals use the central HR payroll model; the UI does not silently invent official salary totals.
- Employee documents use compensation snapshots for salary rows and fail explicitly when the official snapshot is missing.
- EOS and salary preview surfaces are documented as model/draft calculations; persisted payroll and employee state remains backend-owned.
- Advance balances, leave salary settlement, payroll payment issue, and payroll idempotency are guarded by backend utilities/tests.
- Employee list pagination, sorting, search, tab filters, and HR tab query strings use centralized query contracts.

### Protected Exceptions

- HR print/document layouts remain section-owned because they are legal/payroll document surfaces with layout-sensitive text.
- Payroll run editable rows remain section-owned until the final system editable-grid primitive exists.
- Draft entry/previews for salary movement, EOS, and payroll form composition remain frontend-owned where they are not persisted official ledger values.

### Final System Unification Candidates

- Promote HR cards/profile summary rows to the future central card/KPI primitive.
- Move HR legal document print layout into a central document/print layer after document primitives are defined.
- Consider a backend preview endpoint for payroll/EOS draft calculations if multiple future sections need server-side preview before save.

### System Centrality Readiness

HR is prepared for the final system-wide centrality phase. The section now has explicit boundaries for the parts that can become shared primitives and the parts that must stay protected until a real cross-section standard exists.

| Boundary | Current HR owner | Final system target | Migration rule |
| --- | --- | --- | --- |
| Official HR calculations | `@noorix/finance-core`, backend compensation snapshots, HR backend services | Keep as shared core/backend authority | Do not move official payroll, salary, EOS, advance, or settlement formulas into React components. |
| HR API query serialization | `src/services/domains/apiEndpoints/hr-query.ts` plus backend HR/Employees query contracts | Shared domain query pattern | Future sections may copy the pattern, not the HR-specific contract names. |
| Employee names and display labels | `src/utils/employeeDisplayName.ts` and typed HR display models | Central name/display helper across all people/vendor/customer surfaces | Promote only after at least two more sections need the same fallback order. |
| HR cards and profile summaries | HR screen/profile components | Central KPI/card/profile-row primitive | Migrate only through a system primitive, not one-off visual restyling. |
| HR legal/payroll documents | HR document and print builders | Central document/print layer | Migrate only after document primitives support bilingual legal layouts, signatures, logos, fixed payroll rows, and print verification. |
| Payroll editable rows and quick entry | HR payroll form and quick entry components | Central editable-grid standard | Migrate only after editable-grid validation, keyboard behavior, row errors, and financial tests exist. |
| Draft previews | HR salary/EOS/payroll draft models | Optional backend preview endpoints or shared draft model | Persisted records must continue to be recomputed or validated by backend/core before save. |

Non-negotiable carry-forward rules:

- HR frontend remains an input/display layer for official numbers.
- New HR financial paths must call backend/core/snapshot authority and fail visibly when that authority is unavailable.
- Compatibility wrappers may forward to `@noorix/finance-core`, but must not grow new business logic.
- Protected HR print/editing surfaces are not visual cleanup targets until the matching system primitive exists.
- Any future system primitive must include a governance check or an explicit exception entry before HR migrates to it.

### Closure Checks

- 2026-07-07 final workspace audit:
  - `npm run typecheck` passed.
  - `npm run check:hr-governance` passed.
  - `npm test` passed: 131 test files, 521 tests.
  - Source encoding guard passed as part of `npm test`.
  - Strict HR scan found no `any`, `ts-ignore`, `ts-expect-error`, `eslint-disable`, `TODO`, or `FIXME` in the HR closure files touched by this pass.

### File Size Register

Largest HR files after the final audit:

| File | Size |
| --- | ---: |
| `src/modules/HR/tabs/PayrollTab.tsx` | 26.2 KB |
| `src/modules/HR/tabs/EOSCalcTab.tsx` | 24.5 KB |
| `src/modules/HR/tabs/LeaveTab.tsx` | 23.9 KB |
| `src/modules/HR/StaffListScreen.tsx` | 23.8 KB |
| `src/modules/HR/tabs/SalaryCalcTab.tsx` | 22.8 KB |
| `src/modules/HR/EmployeeProfileScreen.tsx` | 22.6 KB |
| `src/modules/HR/tabs/hrPrintDocumentsTabPrintHtml.ts` | 21.7 KB |
| `src/modules/HR/components/TerminationSettlementModal.tsx` | 19.8 KB |

Extracted HR ownership files:

| File | Responsibility | Size |
| --- | --- | ---: |
| `src/modules/HR/tabs/salaryCalcPrint.ts` | Salary calculator print document generation | 9.4 KB |
| `src/modules/HR/components/terminationSettlementHelpers.ts` | Termination settlement print/idempotency helpers | 5.3 KB |
| `src/modules/HR/staffListDataOps.ts` | Staff export rows and custom-allowance synchronization | 4.6 KB |
| `src/modules/HR/tabs/payrollTabModel.ts` | Payroll run row mapping, export rows, and print table model | 3.9 KB |

## Reports

### Centralized

- Frontend reports query contract:
  - `src/services/domains/apiEndpoints/reports-query.ts`
  - `src/services/domains/apiEndpoints/reports-query.test.ts`
  - `src/services/domains/apiEndpoints/reports.ts`
  - `src/hooks/useReports.ts`
  - `src/services/queryKeys/reports.ts`
- P&L display and print boundaries:
  - `src/modules/Reports/reportTypes.ts`
  - `src/modules/Reports/reportHelpers.ts`
  - `src/modules/Reports/ReportsScreen.tsx`
  - `src/modules/Reports/ProfitLossReportWorkspace.tsx`
  - `src/modules/Reports/GeneralPlTable.tsx`
  - `src/modules/Reports/GeneralReportV2Screen.tsx`
  - `src/modules/Reports/generalReportV2Model.ts`
  - `src/modules/Reports/reportsPlMonthPrint.ts`
- Tax report and disclosure boundaries:
  - `src/constants/taxDisclosure.ts`
  - `src/modules/Reports/taxReportTabModel.ts`
  - `src/modules/Reports/TaxReportTab.tsx`
- Bank statement analysis boundaries:
  - `src/hooks/useBankStatementView.ts`
  - `src/modules/Reports/bank/bankAnalysisTab.types.ts`
  - `src/modules/Reports/bank/bankAnalysisUtils.ts`
  - `src/modules/Reports/bank/bankMappingAutoDetect.ts`
  - `src/modules/Reports/bank/bankStatementExportPrint.ts`
  - `src/modules/Reports/BankStatementAnalysisScreen.tsx`
  - `src/modules/Reports/BankStatementUploadModal.tsx`
  - `src/modules/Reports/BankStatementMappingModal.tsx`
- Cost-accounting app analysis boundaries:
  - `src/modules/Reports/costAccountingAppsModel.ts`
  - `src/modules/Reports/costAccountingApps/useCostAccountingAppsScreen.ts`
  - `src/modules/Reports/costAccountingApps/useCostAccountingAppsImports.ts`
  - `src/modules/Reports/costAccountingApps/CostAccountingAppsResultPanels.tsx`
  - `src/modules/Reports/CostAccountingAppsScreen.tsx`
- General report detail boundary:
  - `src/modules/Reports/ReportsDetailModal.tsx`
- Governance:
  - `scripts/check-reports-governance.mjs`

### Accounting and Metrics Rules

- Official P&L, detail, trend, VAT report, VAT planning registry, and period analytics reads use the central reports API contract.
- Reports React screens do not build official query strings or own moved printable/export row builders.
- P&L, tax, bank, cost, and detail helpers shape backend/model values for display/export only; they do not change official report calculations.
- VAT planning and cost-accounting saved slots remain draft/planning surfaces and must not be treated as official accounting records.

### Protected Exceptions

- P&L matrix tables remain raw protected tables because they are financial matrices with sticky columns, hierarchy, totals, and print/export parity.
- Tax disclosure, bank mapping preview, cost-accounting analysis tables, and bank print/export remain protected raw-table exceptions with explicit table governance reasons.
- Bank statement print/export remains section-owned until the final print/export layer supports bank reconciliation layouts.

### Closure Checks

- 2026-07-07 Reports closure:
  - `npm run typecheck` passed.
  - `npm run check:reports-governance` passed.
  - `npm run check:table-governance` passed.
  - `npx vitest run src/modules/Reports src/services/domains/apiEndpoints/reports-query.test.ts src/sourceEncoding.test.ts` passed: 11 files, 39 tests.
  - `npm test` passed: 134 files, 531 tests.
  - Strict reports scan found no `any`, `as any`, `Record<string, any>`, `ts-ignore`, `ts-expect-error`, `eslint-disable`, `TODO`, or `FIXME` across `src/modules/Reports` plus reports/tax/bank contracts.

### File Size Register

Largest Reports files after this pass:

| File | Size |
| --- | ---: |
| `src/modules/Reports/CostAccountingAppsScreen.tsx` | 30.9 KB |
| `src/modules/Reports/ReportsDetailModal.tsx` | 26.0 KB |
| `src/modules/Reports/costAccountingApps/useCostAccountingAppsScreen.ts` | 21.4 KB |
| `src/modules/Reports/BankStatementAnalysisScreen.tsx` | 16.9 KB |
| `src/modules/Reports/GeneralReportV2Screen.tsx` | 16.6 KB |
| `src/modules/Reports/BankStatementMappingModal.tsx` | 16.5 KB |
| `src/modules/Reports/TaxReportTab.tsx` | 14.9 KB |
| `src/modules/Reports/reportsPlMonthPrint.ts` | 13.5 KB |
| `src/modules/Reports/bank/BankStatementTransactionsFullTab.tsx` | 13.3 KB |
| `src/modules/Reports/bank/BankCategoryFormModal.tsx` | 13.0 KB |
| `src/modules/Reports/reportHelpers.ts` | 12.2 KB |
| `src/modules/Reports/GeneralPlTable.tsx` | 11.6 KB |

Extracted Reports ownership files:

| File | Responsibility |
| --- | --- |
| `src/services/domains/apiEndpoints/reports-query.ts` | Reports API query serialization and encoded paths |
| `src/modules/Reports/generalReportV2Model.ts` | V2 statement rows, export rows, and printable HTML |
| `src/modules/Reports/reportsPlMonthPrint.ts` | Classic monthly P&L print body |
| `src/modules/Reports/taxReportTabModel.ts` | Tax disclosure storage, totals, print body, and export rows |
| `src/modules/Reports/bank/bankAnalysisUtils.ts` | Bank transaction summaries, balance verification, and chart aggregates |
| `src/modules/Reports/bank/bankMappingAutoDetect.ts` | Bank sheet row/header/column detection |
| `src/modules/Reports/bank/bankStatementExportPrint.ts` | Bank statement Excel/print builders |

## Suppliers

### Centralized

- Frontend suppliers query contract:
  - `src/services/domains/apiEndpoints/suppliers-query.ts`
  - `src/services/domains/apiEndpoints/suppliers.ts`
  - `src/hooks/useSuppliers.ts`
  - `src/services/queryKeys/suppliers.ts`
- Backend suppliers query contract:
  - `backend/src/suppliers/suppliers-query-contract.util.ts`
  - `backend/src/suppliers/suppliers.controller.ts`
- Suppliers UI and model boundaries:
  - `src/modules/Suppliers/supplierTypes.ts`
  - `src/modules/Suppliers/supplierDisplayModel.ts`
  - `src/modules/Suppliers/supplierFormModel.ts`
  - `src/modules/Suppliers/supplierImportExportModel.ts`
  - `src/modules/Suppliers/supplierProfilePrint.ts`
  - `src/modules/Suppliers/components/SuppliersTab.tsx`
  - `src/modules/Suppliers/components/SupplierTable.tsx`
  - `src/modules/Suppliers/components/SupplierForm.tsx`
  - `src/modules/Suppliers/components/SupplierEditModal.tsx`
  - `src/modules/Suppliers/components/SupplierImportExport.tsx`
  - `src/modules/Suppliers/components/SupplierProfileModal.tsx`
- Governance:
  - `scripts/check-suppliers-governance.mjs`

### Ownership Rules

- Supplier list query params are serialized by `suppliers-query.ts`; the backend controller parses list query values through `suppliers-query-contract.util.ts`.
- Supplier React components own layout, form events, and user feedback only.
- CSV parsing/export shaping is owned by `supplierImportExportModel.ts`.
- Add/edit payload construction and category picker rows are owned by `supplierFormModel.ts`.
- Supplier profile printable HTML is owned by `supplierProfilePrint.ts`; the modal only loads official invoice data and opens the print window.
- Supplier invoice totals and rows remain sourced from invoices backend responses. The supplier profile UI does not recalculate official accounting values beyond display formatting of backend totals.
- Supplier profile print summaries use `useInvoices` `total` and `sums.all`; `supplierProfilePrint.ts` is explicitly barred by governance from aggregating invoice rows for official totals.
- Supplier CSV import uses the `useSuppliers` mutation path so imported rows trigger the same invalidation boundary as manual creates.
- `SupplierProfileModal` mounts only when a concrete supplier is selected, preventing supplier profile invoice reads while the profile is closed.

### Protected Exceptions

- No raw JSX tables remain in the suppliers section.
- Supplier profile print tables use the central print table helpers through `supplierProfilePrint.ts`.
- `SupplierSelect` keeps local usage frequency in storage for UI ordering only; it is not an official financial or operational source of truth.

### Closure Checks

- 2026-07-07 Suppliers closure:
  - `npm run typecheck` passed.
  - `npm run check:suppliers-governance` passed.
  - `npm run check:table-governance` passed.
  - `npm run check:filter-governance` passed.
  - `npx vitest run src/modules/Suppliers src/services/domains/apiEndpoints/suppliers-query.test.ts src/components/common/SupplierSelect.test.ts` passed: 5 files, 10 tests.
  - `npm test` passed: 138 files, 540 tests.
  - Follow-up auditor fixes closed: supplier profile print totals now use backend invoice summaries, CSV import routes through central mutation invalidation, and the profile modal no longer mounts while closed.
  - Strict suppliers scan found no `any`, `as any`, `Record<string, any>`, `ts-ignore`, `ts-expect-error`, `eslint-disable`, `TODO`, or `FIXME` across the suppliers closure scope after cleanup.

### File Size Register

Largest Suppliers files after this pass:

| File | Size |
| --- | ---: |
| `src/modules/Suppliers/components/SupplierTable.tsx` | 9.6 KB |
| `src/modules/Suppliers/components/SupplierProfileModal.tsx` | 8.8 KB |
| `src/modules/Suppliers/components/SuppliersTab.tsx` | 7.2 KB |
| `src/modules/Suppliers/components/SupplierEditModal.tsx` | 4.8 KB |
| `src/modules/Suppliers/components/SupplierForm.tsx` | 4.5 KB |
| `src/modules/Suppliers/components/SupplierImportExport.tsx` | 3.9 KB |
| `src/modules/Suppliers/supplierImportExportModel.ts` | 3.6 KB |
| `src/modules/Suppliers/supplierProfilePrint.ts` | 3.5 KB |

Extracted Suppliers ownership files:

| File | Responsibility |
| --- | --- |
| `src/services/domains/apiEndpoints/suppliers-query.ts` | Supplier list query normalization and serialization |
| `backend/src/suppliers/suppliers-query-contract.util.ts` | Supplier list backend query parsing |
| `src/modules/Suppliers/supplierDisplayModel.ts` | Supplier names, category labels, and type badge metadata |
| `src/modules/Suppliers/supplierFormModel.ts` | Add/edit form state, category options, and payload construction |
| `src/modules/Suppliers/supplierImportExportModel.ts` | Supplier CSV template, export, parse, and import loop result model |
| `src/modules/Suppliers/supplierProfilePrint.ts` | Supplier profile and invoices print HTML |

## Settings

Closed on 2026-07-07.

### Scope

- Frontend settings section:
  - `src/modules/Settings`
- Backup API boundary:
  - `src/services/domains/apiEndpoints/backup.ts`
- Governance:
  - `scripts/check-settings-governance.mjs`

### Ownership Rules

- `SettingsScreen.tsx` only composes tabs and delegates tab definitions, permission filtering, active labels, and active company filtering to `settingsScreenModel.ts`.
- Settings shared contracts live in `settingsTypes.ts`; backup jobs, backup modals, schedule forms, settings companies, and settings mutation/result boundaries are typed centrally.
- Backup API download/upload behavior is centralized in `src/services/domains/apiEndpoints/backup.ts` through safe helpers; settings UI does not call raw `fetch`.
- Backup UI is split into section components under `components/backup`; `BackupTab.tsx` composes data/mutations and passes typed boundaries only.
- Company update payload construction stays in `utils/companyUpdateBody.ts`; `CompaniesTab.tsx` does not rebuild the official update-diff contract inline.
- `companyTabModel.ts`, `CompanyAddForm.tsx`, and `CompanyCardsGrid.tsx` keep company form/card shaping out of the screen so `CompaniesTab.tsx` remains a data/composition boundary.
- `usersTabModel.ts` and `UsersTabForms.tsx` keep user form/edit shaping out of `UsersTab.tsx`; the screen owns list reads, table columns, and composition only.
- Company insight threshold validation remains in `utils/companyInsightThresholdsForm.ts`; the screen owns form interaction and delegates validation.

### Protected Exceptions

- `settingsConstants.ts` owns `FileReader` only for local image-to-data-url conversion. This is UI input handling, not an official source of financial or operational truth.
- No raw JSX tables remain in the settings closure scope.

### Closure Checks

- 2026-07-07 Settings closure:
  - `npm run typecheck` passed.
  - `npm run check:settings-governance` passed.
  - `npm run check:table-governance` passed.
  - `npm run check:filter-governance` passed.
  - `npx vitest run src/modules/Settings` passed: 5 files, 19 tests.
  - `npm test` passed: 139 files, 544 tests.
  - Strict settings scan found no `any`, `as any`, `Record<string, any>`, `ts-ignore`, `ts-expect-error`, `eslint-disable`, `TODO`, or `FIXME` across `src/modules/Settings` and `src/services/domains/apiEndpoints/backup.ts`.
  - Independent audit follow-up fixed one behavior regression risk: backup schedule saves no longer send hidden Google Drive fields; they preserve the previous schedule/retention-only patch behavior.

### File Size Register

Largest Settings files after this pass:

| File | Size |
| --- | ---: |
| `src/modules/Settings/components/backup/BackupSheetsAndModals.tsx` | 19.3 KB |
| `src/modules/Settings/components/CompaniesTab.tsx` | 19.4 KB |
| `src/modules/Settings/components/BackupTab.tsx` | 15.8 KB |
| `src/modules/Settings/components/AppBrandingTab.tsx` | 13.4 KB |
| `src/modules/Settings/components/backup/BackupSystemSection.tsx` | 12.3 KB |
| `src/modules/Settings/components/RolesTab.tsx` | 12.0 KB |
| `src/modules/Settings/components/UsersTabForms.tsx` | 11.4 KB |
| `src/modules/Settings/components/UsersTab.tsx` | 9.4 KB |
| `src/modules/Settings/components/AISettingsTab.tsx` | 8.4 KB |
| `src/modules/Settings/components/ModulePermissionPanel.tsx` | 8.4 KB |

Extracted Settings ownership files:

| File | Responsibility |
| --- | --- |
| `src/modules/Settings/settingsTypes.ts` | Settings, backup, company, and mutation/result contracts |
| `src/modules/Settings/settingsScreenModel.ts` | Tab definitions, permission filtering, and active company filtering |
| `src/modules/Settings/companyTabModel.ts` | Company add/edit/reset contracts and model helpers |
| `src/modules/Settings/usersTabModel.ts` | User list/form/edit contracts and model helpers |
| `src/modules/Settings/components/CompanyAddForm.tsx` | Company creation UI form |
| `src/modules/Settings/components/CompanyCardsGrid.tsx` | Company cards and archive reactivation UI |
| `src/modules/Settings/components/UsersTabForms.tsx` | User create/edit/archive/restore/delete forms |
| `src/modules/Settings/utils/companyUpdateBody.ts` | Company update payload shaping and saved patch merge |
| `src/modules/Settings/utils/companyInsightThresholdsForm.ts` | Insight threshold percent validation |
| `src/modules/Settings/components/backup/backupTabHelpers.ts` | Backup display labels, counts, dates, and badge colors |
| `src/services/domains/apiEndpoints/backup.ts` | Backup endpoint operations, safe blob downloads, and archive uploads |

## Vaults

Closed on 2026-07-07 with `bd73bc55 finalize vaults section cleanup`.

### Scope

- Frontend treasury section:
  - `src/modules/Treasury`
- Shared vault hook and API boundary:
  - `src/hooks/useVaults.ts`
  - `src/services/domains/apiEndpoints/vaults.ts`
  - `src/services/queryKeys/vaults.ts`
  - `src/types/api/domains/vaults.ts`
- Shared display helper:
  - `src/utils/vaultDisplay.ts`
- Backend vault accounting boundary:
  - `backend/src/vaults`
  - `backend/src/vault-balance`
- Governance:
  - `scripts/check-vaults-governance.mjs`

### Ownership Rules

- Official vault balances, inbound totals, outbound totals, and transaction period totals are sourced from backend ledger queries.
- `TreasuryScreen.tsx` composes the screen and delegates grouping, display totals, form payloads, and transaction row shaping to `treasuryModels.ts`.
- `useVaults.ts` owns the typed vault read/write hook and invalidates vault lists, payment options, and sales channel consumers together.
- `VaultTransactionsModal.tsx` uses backend `periodTotalIn` and `periodTotalOut`; it does not derive official period totals from the visible page.
- Vault transaction date ranges must come from the central date filter. The transaction modal no longer creates a silent local current-month fallback.
- Vault create/update is limited to the backend-supported vault types: `cash`, `bank`, and `app`.
- Inter-vault transfers remain backend-owned through `FinancialCoreService.processTransfer`, which posts one balanced transfer ledger entry and checks fiscal-period openness.
- Deleting a vault is blocked when any active ledger entry references its vault id or its account on either the debit or credit side.

### Protected Exceptions

- `vaultDisplay.ts` keeps a display fallback for missing names only; it is not a financial-number fallback.
- `VaultCard` keeps section-specific vault icons until final system-wide icon/card unification.
- `VaultTransactionsModal` export currently requests up to the backend page-size ceiling for one export pass; larger export streaming can be revisited in the final reporting/export pass.

### Final System Unification Candidates

- Promote treasury summary tiles to the future central financial KPI/card primitive.
- Revisit vault export as part of the future central export layer if streaming or background exports become system-wide.
- Move the remaining vault-specific icon set into a central icon registry if more sections adopt the same asset vocabulary.

### Closure Checks

- 2026-07-07 Vaults closure:
  - `tsc --noEmit` passed.
  - `vitest run src/modules/Treasury/treasuryModels.test.ts` passed: 1 file, 4 tests.
  - `jest --config backend/jest.config.cjs vaults-find-one-with-transactions.util.spec.ts vaults.service.spec.ts` passed: 2 files, 2 tests.
  - `check:vaults-governance` passed.
  - `check:table-governance` passed.
  - `check:filter-governance` passed.
  - `check:date-control-governance` passed.
  - `check:responsive-governance` passed.
  - Strict vaults scan found no real `any`, `as any`, `as never`, `as unknown`, `ts-ignore`, `ts-expect-error`, `eslint-disable`, `TODO`, or `FIXME` across the vaults closure scope after cleanup.

## Expenses

Closed on 2026-07-07 with `4046f04e finalize expenses section cleanup`.

### Scope

- Frontend expenses section:
  - `src/modules/Expenses`
- Shared expense contracts and API boundary:
  - `src/types/api/domains/expenses.ts`
  - `src/services/domains/apiEndpoints/accounts-categories-expense.ts`
  - `src/services/queryKeys/expenses.ts`
  - `src/services/domains/apiEndpoints/invoice-list-response.ts`
- SmartChat integration touched by expense-line editing:
  - `src/modules/SmartChat/SmartChatScreen.tsx`
  - `src/modules/SmartChat/components/SmartChatExpenseLinePickSheet.tsx`
  - `src/modules/SmartChat/hooks/useSmartChatUploads.ts`
  - `src/modules/SmartChat/hooks/useSmartChatActions.ts`
  - `src/modules/SmartChat/hooks/useSmartChatExpenseModalHandlers.ts`
- Backend fixed/variable expense boundary:
  - `backend/src/expense-line`
- Governance:
  - `scripts/check-expenses-governance.mjs`

### Centralized

- Expense API/domain contracts:
  - `ExpenseLineRecord`
  - `ExpenseLineCreatePayload`
  - `ExpenseLineUpdatePayload`
  - `ExpenseLinePaymentRecord`
  - `ExpenseLinePaymentSummary`
  - `ExpenseLinePaymentsPage`
  - `ExpensePaymentCreatePayload`
  - `ExpenseBatchCreatePayload`
- Expense frontend display and draft models:
  - `src/modules/Expenses/expenseModels.ts`
  - `src/modules/Expenses/utils/expenseTax.ts`
- Fixed/variable expense form, batch, detail, and history screens now use typed models instead of local ad hoc calculations.
- Backend expense-line payment history now returns official period summary values from aggregate queries.
- Payment history totals use backend invoice-list `sums.outflow` instead of summing the visible page.

### Accounting and Metrics Rules

- Expense payment history, detail totals, and period totals are official backend values.
- Frontend is display-only for official totals; draft tax splitting in forms and batch rows is labeled and contained in `expenseModels.ts`.
- Fixed expense payment locks, coverage validation, installment cadence, and reference amount checks are centralized in the expense model.
- Variable expense payments remain flexible, but official net/tax/total posting remains backend-owned.
- Pagination does not redefine official totals: summaries represent the filtered period/query, not the current visible page.

### Removed Dead Code

- `src/modules/Expenses/components/expenseLineTableUtils.ts`

### Protected Exceptions

- Draft VAT preview remains frontend-owned because it is an input preview before save, not an official posted accounting number.
- Expense batch row UI remains section-owned until the future central editable-grid standard exists.
- Expense cards and compact summaries remain section-specific until the future central financial KPI/card primitive is adopted.
- SmartChat expense picker remains section-adjacent because it depends directly on expense-line selection and edit flows.

### Final System Unification Candidates

- Migrate expense summary cards to the future central financial KPI/card primitive.
- Revisit expense batch table after a central editable-grid standard is created.
- Move export formatting into a future central financial export layer if system-wide export primitives are introduced.

### Closure Checks

- 2026-07-07 Expenses closure:
  - `tsc --noEmit` passed.
  - `vitest run src/modules/Expenses/expenseModels.test.ts src/services/domains/apiEndpoints/accounts-categories-expense.test.ts` passed: 2 files, 5 tests.
  - `jest --config backend/jest.config.cjs expense-line.service.spec.ts` passed: 1 file, 1 test.
  - `check:expenses-governance` passed.
  - `check:table-governance` passed.
  - `check:filter-governance` passed.
  - `check:date-control-governance` passed.
  - `check:responsive-governance` passed.
  - Strict expenses scan found no real `any`, `as any`, `ts-ignore`, `ts-expect-error`, `eslint-disable`, `TODO`, or `FIXME` across the expenses closure scope after cleanup. Remaining textual matches are documented false positives such as `RequireAnyPermission`, `as const`, and governance regex literals.

## Assets Register

Closed on 2026-07-07 with `4fae199e finalize assets register section cleanup`.

### Scope

- Frontend assets section:
  - `src/modules/Assets`
- Shared asset contracts and API boundary:
  - `src/types/api/domains/assets.ts`
  - `src/services/domains/apiEndpoints/company-assets.ts`
  - `src/services/queryKeys/assets.ts`
- Backend company assets boundary:
  - `backend/src/company-assets`
- Warranty queue integrations from purchases/expenses invoices:
  - `warrantyFollowUp`
  - `warrantyFollowUpDone`
- Governance:
  - `scripts/check-assets-governance.mjs`

### Centralized

- Asset API/domain contracts:
  - `AssetRegisterItem`
  - `AssetRegisterPage`
  - `PendingWarrantyInvoiceRow`
  - `AssetCreatePayload`
  - `AssetUpdatePayload`
  - `AssetCompleteFromInvoicePayload`
  - `AssetWarrantyLinePayload`
- Asset frontend display and draft models:
  - `src/modules/Assets/assetsRegisterModel.ts`
  - `src/modules/Assets/utils/assetsRegisterMappers.ts`
- Asset form payloads, validation, warranty-line rows, supplier display names, invoice-kind labels, and response normalization are centralized in the assets model.
- Backend asset list now exposes both filtered acquisition summary and all-company acquisition summary.
- Pending warranty invoice queue is bounded for large datasets.

### Accounting and Metrics Rules

- Assets Register remains an operational asset and warranty register without depreciation.
- Official acquisition cost values are backend-stored and backend-returned.
- When completing an asset from an invoice, the default acquisition-cost draft uses the invoice `totalAmount`, preserving the system rule that financial figures are VAT-inclusive unless a contract says otherwise.
- Frontend may prepare draft form payloads and display labels, but it does not calculate official posted accounting values.
- Filtered table summaries represent the current server-side query, not the visible page.

### Protected Exceptions

- Assets route and backend permissions still accept legacy expense permissions as a compatibility bridge. This is documented and should be revisited during final permission unification.
- Warranty-line draft rows remain frontend-owned because they are unsaved input rows, not official accounting records.
- Asset cards/table mobile layouts remain section-owned until the final system visual/table pass.

### Final System Unification Candidates

- Review the legacy expense-permission fallback when all role migrations are complete.
- Move asset export formatting into a future central financial/export layer if asset exports are expanded.
- Revisit the pending warranty queue if it needs server-side pagination beyond the current bounded queue.

### Closure Checks

- 2026-07-07 Assets Register closure:
  - `tsc --noEmit` passed.
  - `vitest run src/modules/Assets/assetsRegisterModel.test.ts` passed: 1 file, 3 tests.
  - `jest --config backend/jest.config.cjs company-assets.service.spec.ts` passed: 1 file, 2 tests.
  - `check:assets-governance` passed.
  - `check:table-governance` passed.
  - `check:filter-governance` passed.
  - `check:date-control-governance` passed.
  - `check:responsive-governance` passed.
  - Strict assets scan found no real `any`, `as any`, `as never`, `as unknown`, `ts-ignore`, `ts-expect-error`, `eslint-disable`, `TODO`, or `FIXME` across the assets closure scope after cleanup. Remaining textual matches are documented false positives such as `RequireAnyPermission`, `as const`, export aliases, and governance regex literals.

## System-Wide Final Unification Backlog

These items should wait until more sections are closed, unless a future section directly needs one of them:

- Central financial KPI/card primitive for cards and summary bars.
- Central chart state primitives for loading, empty, error, and no-data states.
- Central print/export layout layer for financial documents that are safe to unify.
- Central editable-grid standard for financial row-entry screens.
- Central name display helper adoption across all sections: `nameAr`, `nameEn`, `name`.
- Central official-number rule: backend or shared domain model owns accounting values; frontend owns presentation only.
- Expanded governance that prevents new local financial formulas, local date query serialization, raw filters, or section-specific card primitives once final system primitives exist.

## Open Decisions For Future Sections

- Do not force visual unification before section cleanup is complete.
- Do not convert protected financial print/editing surfaces without a specific design standard and tests.
- When a repeated pattern appears in three or more closed sections, promote it to a system primitive during the final unification phase.


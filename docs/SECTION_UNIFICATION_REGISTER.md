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

# Filter Centrality Roadmap

Status: central filter architecture in progress.

This roadmap keeps visual unification as the final step. The current phase is about routing filter layout, searchable filter inputs, and shared filter value helpers through official central surfaces without changing business behavior.

## Current Decision

| Area | Decision |
| --- | --- |
| Date period filters | Keep `src/ui/date/DateFilterBar` and `useDateFilter` as the official source. |
| Date fields | Keep `DateField`, `DateRangeField`, `DateFilterBar`, `YearDateFilter`, `MonthDateFilter`, and `TransactionDatePicker` under `src/ui/date`. Legacy month/scope pickers are removed. |
| Filter row layout | Use `src/ui/filters/FilterToolbar` as the official filter-row layout, including `variant="execution"` for invoice-style action/filter strips and `variant="bare"` when a domain-specific layout must preserve direct-child CSS. |
| Searchable filter inputs | Use `src/ui/filters/SearchableOptionsPicker` as the official searchable single/multi select. |
| Multi-select CSV values | Use `csvToFilterValues` and `filterValuesToCsv` for comma-separated filter query values. |
| General action toolbars | Use `src/ui/Toolbar` for non-filter action bars; do not stretch `FilterToolbar` to cover actions that are not filters. |
| Invoice filter option model | Use `src/modules/Invoices/invoicesListFilterModel.ts` for invoice filter option construction; UI components should not rebuild these option lists inline. |
| Invoice query model | Use `src/modules/Invoices/invoicesListQueryModel.ts` for invoice filter-to-API normalization across list, export, and print paths. |
| Invoice URL and ImportExport model | Use `src/modules/Invoices/invoicesListUrlModel.ts` for drilldown URL state and `src/modules/Invoices/invoicesListImportExportModel.ts` for ImportExport fetch normalization. The list hook must not parse URL params or call invoice APIs inline. |
| Invoice edit model | Use `src/modules/Invoices/invoiceEditModel.ts` for edit form initialization, supplier policy, tax display recalculation, validation, and update payload construction. The edit modal must stay UI-oriented. |
| Invoice view model | Use `src/modules/Invoices/invoiceViewModel.ts` for read-only invoice field shaping, bilingual names, vault summary, split rows, attachment display, and money/date labels. The view modal must stay display-oriented. |
| Invoice table row model | Use `src/modules/Invoices/invoiceTableRowModel.ts` for list-row text, dates, amount tones, vault chips, fallback values, and row-level display normalization. Table renderers must stay layout-oriented. |
| Invoice executive cards model | Use `src/modules/Invoices/invoiceExecutiveCardsModel.ts` for executive card numbers, counts, vault flow rows, and remainder tone rules. Executive cards must stay layout-oriented. |
| Invoice cash report model | Use `src/modules/Invoices/invoicesCashReportModel.ts` for cash-vault filtering, totals, cash-on-hand aggregation, and print HTML shaping. The cash report modal must stay load/display-oriented. |
| Invoice day close report model | Use `src/modules/Invoices/dayCloseReportModel.ts` for day-close date ranges, company labels, bilingual names, counterparty labels, and cash KPI rules. Day-close views must stay report/display-oriented. |
| Invoice API query contract | Use `src/services/domains/apiEndpoints/invoice-list-query.ts` for frontend invoice list query serialization and `InvoiceListQueryDto` plus `InvoiceListQueryContract` for backend list validation/normalization. |
| Dashboard period model | Use `src/modules/Dashboard/dashboardPeriodModel.ts` for dashboard year/month UI period state and labels. |
| Dashboard API period query | Use `src/services/domains/apiEndpoints/dashboard-period-query.ts` for dashboard overview and dashboard insights query serialization, query-key normalization, and request readiness checks. |
| Dashboard backend period DTO | Use `backend/src/common/dto/dashboard-period-query.dto.ts` and `DashboardPeriodQueryDto` for dashboard overview and reporting insights validation. |
| Purchase batch query contract | Use `src/services/domains/apiEndpoints/purchase-batch-query.ts` for frontend purchase batch query serialization/cache keys and `PurchaseBatchSummariesQueryDto` plus `PurchaseBatchSummariesQueryContract` for backend validation/normalization. |
| HR API query contract | Use `src/services/domains/apiEndpoints/hr-query.ts` for HR and employees query serialization, encoded mutation paths, employees paged list params, employee/year filters, compensation snapshot batches, payroll month filters, and delete flags. Use `EmployeeListQueryDto` plus `EmployeeListQueryContract` for employees list backend validation/normalization. Use `HrEmployeeQueryDto`, `HrYearQueryDto`, `HrLeavesQueryDto`, `HrResidenciesQueryDto`, and `hr-query-contract` for HR tab backend validation/normalization. |
| Reports API query contract | Use `src/services/domains/apiEndpoints/reports-query.ts` for P&L, P&L detail/trend, VAT report, VAT planning, and period analytics query serialization. `reports.ts` must not hand-build report query strings. Reports governance now scans the full Reports module closure scope. |
| Suppliers API query contract | Use `src/services/domains/apiEndpoints/suppliers-query.ts` for supplier list query serialization and `backend/src/suppliers/suppliers-query-contract.util.ts` for backend supplier list query parsing. `suppliers.ts` and `suppliers.controller.ts` must not rebuild supplier list params inline. |
| Legacy filter imports | Keep `src/shared/components/FilterToolbar.tsx` as a compatibility shim only. |
| Legacy searchable picker imports | Keep `src/components/common/SearchableOptionsPicker.tsx` as a compatibility shim only. |
| Domain filters | Keep screen-owned state and API parameters for now; centralize helpers and layout first. |
| Visual unification | Defer until screens are routed through the central filter surfaces. |
| Build from scratch | If a filter surface is cleaner to rebuild centrally than patch locally, build the central version from scratch and migrate usage to it. |
| Section-by-section execution | Finish one section at a time, starting with invoices, before moving to dashboard, orders, purchases, HR, and reports. |

## First Implementation Batch

| Step | Scope | Rule |
| --- | --- | --- |
| 1 | Add `src/ui/filters` | No visual redesign; preserve existing CSS classes while ownership moves central. |
| 2 | Re-export from `src/ui` | New imports should use `import { FilterToolbar, SearchableOptionsPicker } from '../../ui'`. |
| 3 | Keep compatibility shims | Existing old imports do not break, but new screen code must not use them. |
| 4 | Convert safe screens | Date filter bars, filter rows, searchable filter inputs, and CSV helpers move to central import paths. |
| 5 | Add governance | Block new direct imports from legacy filter paths. |
| 6 | Block drift | Prevent raw `<select>`, `Input type="select"`, and unwrapped month scope filters in screen code. |

## Later Phases

| Phase | Work | Notes |
| --- | --- | --- |
| Domain filter model | Centralize reset/apply contracts around the existing screen-owned API parameters. | Keep API behavior unchanged. |
| Invoice filter reference | Use invoices as the reference for complex domain filters. | Type, supplier, category, creator, vault, notes, cancelled. |
| Orders and purchases | Apply the same central filter composition pattern. | Lower risk than financial reports. |
| HR filters | Backend/frontend query contracts are centralized for employee list and HR tabs; visual filter harmonization remains deferred. | Keep payroll math untouched. |
| Financial reports | Reports query centrality, P&L print/export shaping, tax model helpers, bank analysis/mapping helpers, and cost-accounting model boundaries are protected by `check:reports-governance`. | Do not refactor financial table semantics casually. |
| Suppliers | Supplier list query contract, CSV import/export model, add/edit form model, display model, and profile print model are protected by `check:suppliers-governance`. | Supplier profile invoice numbers and totals stay sourced from invoices backend responses. |
| Visual pass | Harmonize spacing, responsive behavior, icons, and empty/reset affordances from the central layer. | Final phase only. |

## Section Execution Ledger

| Section | Current central surfaces | Remaining protected work |
| --- | --- | --- |
| Invoices | `SmartTable`, `FilterToolbar`, `DateFilterBar`, `SearchableOptionsPicker`, `DateField`, `Toolbar`, `invoicesListFilterModel`, `invoicesListQueryModel`, `invoicesListUrlModel`, `invoicesListImportExportModel`, `invoiceEditModel`, `invoiceViewModel`, `invoiceTableRowModel`, `invoiceExecutiveCardsModel`, `invoicesCashReportModel`, `dayCloseReportModel`, `invoice-list-query`, `InvoiceListQueryDto`, `InvoiceListQueryContract`, print table builders. | Closed for frontend/backend query centrality and screen/edit/report hardening pass started; visual harmonization waits for the final visual pass. |
| Dashboard | `FilterToolbar`, `DateFilterBar`, `SearchableOptionsPicker`, `SmartTable`, `Toolbar`, `dashboardPeriodModel`, `dashboard-period-query`, `DashboardPeriodQueryDto`, protected calendar print table builder. | Current section pass; keep calendar print generation protected and action bars centralized. |
| Purchases | `DateFilterBar`, `FilterToolbar`, `SearchableOptionsPicker`, `SmartTable`, `purchase-batch-query`, `PurchaseBatchSummariesQueryDto`, `PurchaseBatchSummariesQueryContract`. | Current section pass; editable batch-entry grid is protected until a dedicated table-editor design pass. |
| Orders | Pending section pass. | Reuse invoice filter composition where behavior matches. |
| HR | `SearchableOptionsPicker`, `DateField`, `hr-query`, `EmployeeListQueryDto`, `EmployeeListQueryContract`, `HrEmployeeQueryDto`, `HrYearQueryDto`, `HrLeavesQueryDto`, `HrResidenciesQueryDto`, `hr-query-contract`, `hrKeys`, `employeeKeys`, protected payroll/document/settlement tables. | Query centrality closed for employees, payroll runs, advances, compensation snapshots, leaves, leave salary settlements, residencies, documents, movements, allowances, and deductions. 2026-07-07 audit passed `typecheck`, `check:hr-governance`, and full frontend test suite; visual harmonization waits for the final visual pass. |
| Financial reports | `reports-query`, `reportKeys`, `reportHelpers`, `generalReportV2Model`, `reportsPlMonthPrint`, `taxReportTabModel`, bank analysis/mapping/export helpers, cost-accounting model/hooks, protected financial tables, `check:reports-governance`. | Reports typed/query/print/model centrality closed in workspace on 2026-07-07; visual harmonization waits for the final visual pass. |
| Suppliers | `suppliers-query`, `supplierKeys`, `supplierDisplayModel`, `supplierFormModel`, `supplierImportExportModel`, `supplierProfilePrint`, backend `suppliers-query-contract`, `SmartTable`, central print table helpers, `check:suppliers-governance`. | Suppliers typed/query/import/export/profile-print boundaries closed in workspace on 2026-07-07; visual harmonization waits for the final visual pass. |

## Acceptance Checks

| Check | Expected |
| --- | --- |
| `npm.cmd run check:filter-governance` | Passes. |
| `npm.cmd run check:date-control-governance` | Passes. |
| `npm.cmd run check:dashboard-governance` | Passes when the dashboard section is touched. |
| `npm.cmd run check:invoices-governance` | Passes. |
| `npm.cmd run check:hr-governance` | Passes when the HR section is touched. |
| `npm.cmd run check:reports-governance` | Passes when the reports section is touched. |
| `npm.cmd run check:suppliers-governance` | Passes when the suppliers section is touched. |
| `npm.cmd run check:purchases-governance` | Passes when the purchases section is touched. |
| `npm.cmd run check:table-governance` | Passes. |
| TypeScript | Passes. |

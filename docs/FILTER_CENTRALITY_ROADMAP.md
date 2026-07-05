# Filter Centrality Roadmap

Status: central filter architecture in progress.

This roadmap keeps visual unification as the final step. The current phase is about routing filter layout, searchable filter inputs, and shared filter value helpers through official central surfaces without changing business behavior.

## Current Decision

| Area | Decision |
| --- | --- |
| Date period filters | Keep `src/ui/date/DateFilterBar` and `useDateFilter` as the official source. |
| Date fields | Keep `DateField`, `DateRangeField`, and `DateMonthScopePicker` under `src/ui/date`. |
| Filter row layout | Use `src/ui/filters/FilterToolbar` as the official filter-row layout, including `variant="execution"` for invoice-style action/filter strips and `variant="bare"` when a domain-specific layout must preserve direct-child CSS. |
| Searchable filter inputs | Use `src/ui/filters/SearchableOptionsPicker` as the official searchable single/multi select. |
| Multi-select CSV values | Use `csvToFilterValues` and `filterValuesToCsv` for comma-separated filter query values. |
| General action toolbars | Use `src/ui/Toolbar` for non-filter action bars; do not stretch `FilterToolbar` to cover actions that are not filters. |
| Invoice filter option model | Use `src/modules/Invoices/invoicesListFilterModel.ts` for invoice filter option construction; UI components should not rebuild these option lists inline. |
| Invoice query model | Use `src/modules/Invoices/invoicesListQueryModel.ts` for invoice filter-to-API normalization across list, export, and print paths. |
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
| HR filters | Convert after orders/purchases because payroll and leave flows are more sensitive. | Keep payroll math untouched. |
| Financial reports | Convert only after a dedicated protected-report decision. | Do not refactor financial table semantics casually. |
| Visual pass | Harmonize spacing, responsive behavior, icons, and empty/reset affordances from the central layer. | Final phase only. |

## Section Execution Ledger

| Section | Current central surfaces | Remaining protected work |
| --- | --- | --- |
| Invoices | `SmartTable`, `FilterToolbar`, `DateFilterBar`, `SearchableOptionsPicker`, `DateField`, `Toolbar`, `invoicesListFilterModel`, `invoicesListQueryModel`, print table builders. | Closed for centrality; visual harmonization waits for the final visual pass. |
| Dashboard | `FilterToolbar`, `DateMonthScopePicker`, `SearchableOptionsPicker`, `SmartTable`, `Toolbar`, `dashboardPeriodModel`, protected calendar print table builder. | Current section pass; keep calendar print generation protected and action bars centralized. |
| Orders and purchases | Pending section pass. | Reuse invoice filter composition where behavior matches. |
| HR | Pending section pass. | Keep payroll/residency financial behavior protected. |
| Financial reports | Pending section pass. | Convert only with protected report-specific review. |

## Acceptance Checks

| Check | Expected |
| --- | --- |
| `npm.cmd run check:filter-governance` | Passes. |
| `npm.cmd run check:date-control-governance` | Passes. |
| `npm.cmd run check:dashboard-governance` | Passes when the dashboard section is touched. |
| `npm.cmd run check:invoices-governance` | Passes. |
| `npm.cmd run check:table-governance` | Passes. |
| TypeScript | Passes. |

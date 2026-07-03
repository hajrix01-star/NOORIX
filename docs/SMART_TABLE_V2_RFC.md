# SmartTable v2 RFC

Date: 2026-07-03

Status: phase 1 implemented behind the current `SmartTable` API.

## Decision

Keep `SmartTable` as the Noorix official table API. TanStack Table is now introduced as an internal row/column model engine only; Noorix rendering, CSS, mobile cards, manual sorting, manual pagination, and protected table boundaries remain unchanged.

## Why Not In This Cleanup

| Reason | Impact |
|---|---|
| `SmartTable` has runtime sizing, padding, row numbering, row style, sorting, and footer contracts | broad UI blast radius |
| `SimpleTable` and `SmartTable` have tests tied to current behavior | direct refactor may break CI |
| Financial/report tables need MatrixTable/PrintTable decisions first | avoids accidental financial layout regressions |

## Required Capabilities Before v2

| Capability | Needed For |
|---|---|
| Editable cells | purchases, payroll, order forms |
| Grouped/tree rows | P&L and financial hierarchy |
| Summary/footer rows | reports and invoices |
| Sticky columns | wide financial matrices |
| Mobile card layout | existing responsive behavior |
| Print-safe mode | payroll, tax, bank, invoices |
| Runtime column sizing | current SmartTable/SimpleTable APIs |
| Empty/loading/error states | consistent table UX |

## Proposed Path

| Phase | Work |
|---|---|
| 0 | Accept `docs/TABLE_NEXT_PHASE_RFC.md` so MatrixTable, EditableTable, and protected print boundaries are known |
| 1 | Implement TanStack as a read-only row/column engine behind the existing `SmartTable` API |
| 2 | Add compatibility tests for sorting, row numbers, padding, compact mode, footer cells, mobile cards |
| 3 | Move sorting state to TanStack internally while keeping `onSort`, `sortKey`, and `sortDir` compatible |
| 4 | Evaluate column sizing/resizing through TanStack without changing Noorix CSS tokens |
| 5 | Decide whether to graduate to `SmartTableV2` or keep the adapter hidden inside `SmartTable` |

## Implemented Phase 1

| Item | Result |
|---|---|
| Dependency | `@tanstack/react-table` |
| Internal adapter | `src/ui/SmartTable/tableEngine.ts` |
| Public API break | none |
| Rendering ownership | still Noorix JSX/CSS |
| Sorting | still manual/external-compatible |
| Pagination | still manual/external-compatible |
| Mobile cards/compact rows | unchanged, powered by engine row model |
| Protected financial/report tables | untouched |

## Acceptance For Any Future Implementation

| Check | Required |
|---|---|
| No API break for current `SmartTable` consumers | yes |
| Existing table governance remains green | yes |
| Financial/report tables untouched unless specifically scoped | yes |
| Visual smoke for desktop/mobile | yes |
| CI build, financial tests, and table tests | yes |


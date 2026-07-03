# SmartTable v2 RFC

Date: 2026-07-03

Status: RFC only. Do not implement inside cleanup batches.

## Decision

Keep `SmartTable` as the Noorix official table API. Evaluate TanStack Table as an internal engine only after compatibility coverage exists.

## Why Not In This Cleanup

| Reason | Impact |
|---|---|
| `SmartTable` has runtime sizing, padding, row numbering, row style, sorting, and footer contracts | broad UI blast radius |
| `SimpleTable` and `SmartTable` have tests tied to current behavior | direct refactor may break CI |
| Financial/report tables need MatrixTable/PrintTable decisions first | avoids accidental financial layout regressions |

## Current UI-Core Inline Baseline

| Component | Remaining `style={{` | Decision |
|---|---:|---|
| `SmartTable` | 7 |
| `SmartTable/buildFooterCells` | 1 |
| `SimpleTable` | 4 |
| `MatrixTable` | 5 |
| `KebabMenu` | 1 |
| `MetricCard` | 1 |

These are central UI exceptions, not screen-level drift. Reducing them is allowed only through component API work with compatibility tests, not through one-off CSS moves.

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
| 1 | Freeze current `SmartTable` API and document runtime inline exceptions |
| 2 | Add compatibility tests for sorting, row numbers, padding, compact mode, footer cells, mobile cards |
| 3 | Run a TanStack compatibility pilot behind `SmartTable` in one non-financial table |
| 4 | Decide whether to graduate to `SmartTableV2` or keep current engine |

## Acceptance For Any Future Implementation

| Check | Required |
|---|---|
| No API break for current `SmartTable` consumers | yes |
| Existing table governance remains green | yes |
| Financial/report tables untouched unless specifically scoped | yes |
| Visual smoke for desktop/mobile | yes |
| CI build, financial tests, and table tests | yes |


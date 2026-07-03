# SmartTable Compatibility Audit

Date: 2026-07-03

Status: phase 2 compatibility audit implemented; no feature expansion.

## Scope

| Item | Result |
|---|---|
| Public `SmartTable` API | unchanged |
| TanStack role | still hidden read-only row/column engine |
| Noorix JSX/CSS rendering | unchanged |
| Sorting contract | external `onSort`, `sortKey`, `sortDir` unchanged |
| Pagination contract | external `page`, `pageSize`, `onPageChange` unchanged |
| Protected domains | untouched |

## Compatibility Coverage Added

| Contract | Coverage |
|---|---|
| Pagination callbacks | previous/next call external `onPageChange` |
| Controlled search | `searchValue` and `onSearchChange` remain caller-owned |
| Column visibility | hidden columns are removed from header/body/footer layout |
| Footer rows | `footerRow` colspan is calculated against visible columns |
| Row decoration | `getRowClassName` and `getRowStyle` still apply |
| Expanded rows | `isRowExpanded` and `renderExpandedRow` still render below the row |
| Compact mobile rows | narrow-layout `renderCompactRow` keeps the same ordered row model |
| Legacy row keys | `keyExtractor` now drives React row keys when provided |

## Small Fix

| File | Fix |
|---|---|
| `src/ui/SmartTable/SmartTable.tsx` | uses existing `keyExtractor` prop for table, compact, and mobile row keys |

## Non-Goals

| Item | Decision |
|---|---|
| Move sorting logic into TanStack | not done |
| Move pagination logic into TanStack | not done |
| Editable cells | not done; requires EditableTable RFC |
| Grouped/tree rows | not done; requires financial hierarchy decision |
| Protected payroll/tax/bank/purchases conversions | not touched |

## Verification

| Command | Required Result |
|---|---|
| `npm.cmd run test -- SmartTable` | pass |
| `npm.cmd run typecheck` | pass |
| `npm.cmd run check:table-governance` | pass |
| `npm.cmd run check:inline-style-governance` | pass |
| `npm.cmd run check:css-governance` | pass |
| `npm.cmd run check:control-governance` | pass |

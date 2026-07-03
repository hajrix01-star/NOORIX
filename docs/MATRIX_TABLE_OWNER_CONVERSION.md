# MatrixTable Owner Conversion

Date: 2026-07-03

Status: implemented as the first MatrixTable conversion.

## Scope

| File | Before | After |
|---|---|---|
| `src/modules/Owner/components/OwnerMonthlyComparisonTable.tsx` | manual matrix `<table>` | `MatrixTable` |
| `src/ui/MatrixTable.tsx` | not present | central matrix table primitive |
| `src/ui/MatrixTable.test.tsx` | not present | focused MatrixTable coverage |

## Counts

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Manual `<table>` outside `src/ui` | 54 | 53 | -1 |
| Files with manual tables outside `src/ui` | 34 | 33 | -1 |
| `MatrixTable` JSX usages | 0 | 1 | +1 |
| Files using `MatrixTable` JSX | 0 | 1 | +1 |
| `matrix-table` exceptions | 2 | 1 | -1 |

## Preserved Behavior

| Behavior | Preserved |
|---|---|
| Metric chips | yes |
| 12 monthly columns | yes |
| Company color accent | yes |
| Best-month heat background | yes |
| Net-profit positive/negative colors | yes |
| Grand monthly totals row | yes |
| Percentage column | yes |
| Horizontal overflow | yes |

## No-Touch Scope

| Scope | Touched |
|---|---|
| Payroll | no |
| Tax/VAT | no |
| Bank | no |
| Purchases | no |
| Financial P&L / cost reports | no |

## Verification

| Command | Required |
|---|---|
| `npm.cmd run check:table-governance` | pass |
| `npm.cmd run check:inline-style-governance` | pass |
| `npm.cmd run test -- MatrixTable` | pass |
| `npm.cmd run typecheck` | pass |
| `git diff --check` | pass |

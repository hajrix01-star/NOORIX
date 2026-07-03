# SimpleTable Dashboard Conversion

Date: 2026-07-03

Status: implemented; non-financial dashboard display table only.

## Counts

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Manual `<table>` outside `src/ui` | 58 | 57 | -1 |
| Files with manual tables outside `src/ui` | 38 | 37 | -1 |
| `dashboard-matrix` files | 1 | 0 | -1 |
| `dashboard-matrix` tables | 1 | 0 | -1 |

## Converted

| File | Tables removed | New central component |
|---|---:|---|
| `src/modules/Dashboard/overview/components/DashboardOverviewWeeklySalesPanel.tsx` | 1 | `SimpleTable` |

## Left Untouched

| File | Reason |
|---|---|
| `src/modules/Owner/components/OwnerMonthlyComparisonTable.tsx` | financial owner comparison matrix with dynamic heat styles |
| `src/modules/Reports/GeneralPlTable.tsx` | P&L hierarchy with sticky column, collapse controls, and financial tones |

## Verification

| Command | Expected |
|---|---|
| `npm.cmd run check:table-governance` | pass |
| `npm.cmd run typecheck` | pass |

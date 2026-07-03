# Frontend Inline Style Governance

Date: 2026-07-03

Status: active guardrail.

## Baseline

| Metric | Count |
|---|---:|
| `style={{` total | 39 |
| files with `style={{` | 24 |
| inside `src/ui` | 19 |
| `src/ui` files | 6 |
| outside `src/ui` | 20 |
| outside `src/ui` files | 18 |

## Top Files

| File | Count |
|---|---:|
| `src/ui/SmartTable/SmartTable.tsx` | 7 |
| `src/ui/MatrixTable.tsx` | 5 |
| `src/ui/SimpleTable.tsx` | 4 |
| `src/components/UserMenu.tsx` | 2 |
| `src/modules/Reports/GeneralPlTable.tsx` | 2 |
| `src/components/AppHeader.tsx` | 1 |
| `src/components/common/ProductSearchInput.tsx` | 1 |
| `src/components/common/SearchableOptionsPicker.tsx` | 1 |
| `src/components/common/SupplierSelect.tsx` | 1 |
| `src/modules/Dashboard/components/DashboardCalendarTab/components/DashboardCalendarDayCell.tsx` | 1 |
| `src/modules/Dashboard/overview/components/DashboardOverviewTopCharts.tsx` | 1 |
| `src/modules/Owner/components/OwnerFilterBar.tsx` | 1 |
| `src/modules/Owner/components/OwnerPerformanceChart.tsx` | 1 |
| `src/modules/Purchases/batch/components/PurchasesBatchToolbar.tsx` | 1 |
| `src/modules/Reports/BankStatementMappingModal.tsx` | 1 |
| `src/ui/SmartTable/buildFooterCells.tsx` | 1 |
| `src/ui/MetricCard.tsx` | 1 |
| `src/ui/KebabMenu.tsx` | 1 |

## Latest Reduction

The 2026-07-03 local batch reduced the governed count from 88 to 44 by moving safe display-only styles from HR, reports, owner analytics, bank analysis, and purchase batch rows into CSS/classes. Remaining inline styles are primarily dynamic UI core sizing, popover positioning, chart/data colors, and report runtime backgrounds.

The closure batch added `scripts/inline-style-manual-reasons.json`. CI now requires every remaining inline-style file to have a category, decision, and reason; stale reasons also fail the check.

The MatrixTable owner conversion moved owner monthly comparison runtime styles into `src/ui/MatrixTable.tsx`. This intentionally shifts matrix sizing, row tone, row accent, and heat-cell style exceptions into the central UI system while reducing outside-UI inline styles.

The runtime visual primitives batch added `ColorSwatch` and `DataBar` to `src/ui`, moving repeated chart dots, color swatches, and report bars out of Dashboard, Orders, Owner, and Settings screens. This reduced the governed count from 47 to 39 without touching payroll, tax, bank, purchases, or financial report flows.

## Rule

Run:

```bash
npm.cmd run check:inline-style-governance
```

The check fails if inline style usage grows beyond this baseline. Reductions should lower the baseline in the same PR.

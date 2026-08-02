# Dashboard Number Governance

This document is the source-of-truth register for visible Dashboard numbers.

## Rule

Dashboard UI may format, translate labels, choose colors, hide empty rows, and render chart state.
Dashboard UI must not calculate official amounts, averages, percentages, comparisons, or totals.

## Official Sources

| UI area | Visible numbers | Backend source |
| --- | --- | --- |
| KPI cards | sales, purchases, gross profit, expenses, net profit, ratio percent, tone | `GET /api/v1/dashboard/overview` -> `presentation.kpiCards` |
| Revenue daily average card panel | revenue daily average, previous month average, customer daily average | `GET /api/v1/dashboard/overview` -> `salesPack.metrics.monthAverage` and `presentation.previousMonthAverage` |
| Revenue by shift inside KPI card | shift amount, customers, share percent | `GET /api/v1/dashboard/overview` -> `salesPack.metrics.shiftTotals` |
| Sales timeline | sales, purchases, expenses, customers, average invoice | `GET /api/v1/dashboard/overview` -> `presentation.timeline` |
| Weekly daily-sales comparison | week average, baseline average, change percent | `GET /api/v1/dashboard/overview` -> `presentation.weeklyComparison` |
| Yearly monthly daily average table | monthly sales, daily average, change percent | `GET /api/v1/dashboard/overview` -> `salesPack.metrics.yearMonthlyDailyAverages` |
| Calendar day cells | day amount | `GET /api/v1/sales-summaries/dashboard-pack` -> `metrics.dailyTotals` |
| Calendar average banner | daily average | `GET /api/v1/sales-summaries/dashboard-pack` -> `metrics.monthAverage.revenueAvgDaily` |
| Calendar weekday headers | sales average for each weekday | `GET /api/v1/sales-summaries/dashboard-pack` -> `metrics.weekdayAverages` |
| App-sales dashboard | app totals, channel totals, percentages | `GET /api/v1/sales-summaries/dashboard-pack` -> `metrics.appSales` |
| Channel breakdown | amount, share percent | `GET /api/v1/sales-summaries/dashboard-pack` -> `metrics.channelBreakdown` |
| Top suppliers | amount, invoice count, share percent | `GET /api/v1/dashboard/overview` -> `periodData.topSuppliers` |
| Purchase categories | amount, share percent | `GET /api/v1/dashboard/overview` -> `periodData.purchaseCategoryBreakdown` |

## Request Boundary

The Dashboard overview tab uses one HTTP request only: `GET /api/v1/dashboard/overview`.
Heavy secondary tabs may still request their own data when opened, such as Calendar and App Sales.

## UI-Only Allowances

The frontend may still do these non-official calculations:

- Responsive chart sizing and empty-state detection.
- Color intensity and target-achievement visual banding in calendar cells.
- Number formatting and rounding for display.
- Local label selection based on language.

## Guard

Run:

```bash
npm run check:dashboard-number-governance
```

The guard blocks old UI calculation helpers from reappearing in dashboard hooks/components and verifies that backend contracts still exist.

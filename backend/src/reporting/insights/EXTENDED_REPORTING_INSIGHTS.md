# Extended Reporting Insights (internal contract)

Backend-only orchestration. **Not** exposed via HTTP, Smart Chat, or dashboard UI in the current wave.

## Role

`ReportingInsightsAggregatorService` (`reporting-insights-aggregator.service.ts`) calls three existing services in parallel and returns a single **extended** payload. It does **not** implement new reporting queries or change how financial numbers are produced.

## Combined services

| Service | Responsibility (unchanged) |
|---------|----------------------------|
| `DashboardInsightsService` | Dashboard Smart Insights v1 (ratios, health, warnings from facade summary). |
| `PurchaseSupplierInsightsService` | Purchase / supplier deterministic warnings from the same dashboard summary inputs. |
| `ExpenseInsightsService` | Expense deterministic warnings from the same summary inputs. |

Each service continues to use `ReportingFacade.getDashboardSummary` (and related types) as today. The aggregator only **awaits** their results and merges metadata.

## Payload shape (`ExtendedReportingInsightsPayload`)

| Field | Description |
|-------|-------------|
| `schemaVersion` | Envelope version for the **extended** object (`1`). Distinct from each child’s own `schemaVersion`. |
| `generatedAt` | ISO timestamp when the aggregator finished assembling the response. |
| `context` | `companyId`, `year`, `selectedMonth`, `periodStart`, `periodEnd`, and `labels` (`dashboard`, `purchases`, `expenses` scope markers for readers). |
| `dashboardInsights` | Full `DashboardInsightsPayload` from `DashboardInsightsService` — **unchanged contract**. |
| `purchaseSupplierInsights` | Full `PurchaseSupplierInsightsPayload` — **unchanged contract**. |
| `expenseInsights` | Full `ExpenseInsightsPayload` — **unchanged contract**. |
| `warnings` | Merged list of **`CombinedInsightWarning`**: each item is a shallow copy of an `InsightItem` plus `source: 'dashboard' \| 'purchases' \| 'expenses'`. |

## Non-goals (explicit)

- This layer **does not** calculate financial totals, KPIs, P&L lines, VAT, or dashboard aggregates.
- It **does not** change KPI math, P&L, VAT, dashboard totals, or reporting query logic.
- **Child** payloads (`dashboardInsights`, `purchaseSupplierInsights`, `expenseInsights`) are returned **as produced** by those services; their schemas and `warnings` arrays are **not mutated**.
- **Top-level** `warnings` are **new objects** (spread + `source`); they are not references into the child arrays.

## Merged `warnings` behaviour

1. **Order of intake**: dashboard → purchases → expenses (each child’s `warnings` in original order).
2. **Dedupe**: if two items share the same **`id` + `metricBasis` + `category`**, the **first** occurrence wins (dashboard beats purchases beats expenses).
3. **Sort**: `critical` → `warning` → `info`; within the same severity, **merge order** above is preserved.

## Call-site notes

- **`selectedMonth`**: Pass `1–12` when month-scoped rules should run in all three builders; omit or pass `null` for annual-style behaviour. Future HTTP or internal callers must align `dateRange` (especially `periodStart` / `periodEnd`) with the intended month when using month-scoped insights.
- **Shared summary optimization** (a single `getDashboardSummary` shared across the three services) is **intentionally deferred**; the aggregator currently triggers up to three facade reads via the existing services.

## Related code

- Types: `reporting-insights-aggregator.types.ts`
- Aggregator: `reporting-insights-aggregator.service.ts`
- Module registration: `reporting.module.ts` (provider + export; no new routes)

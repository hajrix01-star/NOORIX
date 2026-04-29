# Dashboard Smart Insights — ملخص داخلي (v1)

ملخص للمرجع الداخلي وللمتابعة لاحقًا في ملاحظات المشروع.

## Smart Insights v1 — completed

- Uses **company-specific thresholds** (resolved per company; overrides merged with defaults server-side).
- **Contextual alerts** are shown **inside KPI cards** on Dashboard Overview (ratio/margin lines + optional compact second lines where applicable).
- **No separate alert rail** on the overview tab.
- **No changes to KPI calculations** (display-only enrichment from the insights payload).
- **No changes to P&L / VAT / reporting math** — insights remain derived/read-only relative to ledger flows.
- **Arabic UI**: insight-related percentages use **English (Latin) digits** for consistency with numeric KPI styling.

## Related areas (for navigation)

- Backend: reporting insights service + rules (`backend/src/reporting/insights/`).
- Frontend: KPI footer mapping (`dashboardOverviewKpiInsightFooters.ts`), insights query unchanged (`useDashboardInsights`, `reportingInsightsApi`).

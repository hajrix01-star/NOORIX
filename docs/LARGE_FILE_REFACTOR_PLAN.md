# Large File Refactor Plan

Purpose: reduce NOORIX god files without changing behavior or accounting policy.

Guardrails:
- One refactor batch should move structure only: hooks, selectors, services, or presentational components.
- Do not change API contracts, ledger-first reporting, VAT policy, P&L policy, or official calculation sources.
- Each batch must pass typecheck, frontend build, backend build when backend files are touched, and relevant tests.
- Add or keep smoke tests before splitting a screen with complex UI state.

Priority:

| Priority | File | Target split | Required checks |
| --- | --- | --- | --- |
| 1 | `src/modules/Orders/StaffOrdersView.tsx` | Extract filters/state hook, table model, action handlers, print/export helpers | Orders screen smoke + typecheck + build |
| 2 | `backend/src/chat/handlers/dashboard-insights.handler.ts` | Extract intent routing, payload builders, response formatting | Existing handler specs + backend tests |
| 3 | `src/modules/Reports/costAccountingApps/useCostAccountingAppsScreen.ts` | Extract import workflow, saved slots state, report selectors | Cost accounting specs + build |
| 4 | `src/modules/HR/tabs/AdvancesTab.tsx` | Extract edit/settlement modals and grouped rows model | HR advances smoke + frontend tests |

Definition of done:
- The original screen/service imports smaller modules and keeps the same behavior.
- No calculation logic is rewritten during the move.
- `rg` confirms no duplicated copy of moved logic remains.

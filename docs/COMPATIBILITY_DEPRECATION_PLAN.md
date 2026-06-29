# Compatibility Deprecation Plan

Purpose: keep compatibility wrappers intentional while NOORIX moves toward single-source modules. This file prevents old wrappers from becoming a second source of truth.

Rules:
- A wrapper may forward to a central package, but must not contain new business logic.
- New code should import the central replacement directly unless the wrapper is explicitly marked `keep`.
- Removal requires a small migration PR with typecheck, build, and relevant tests.

| Area | Wrapper | Status | Replacement | Remove after | Notes |
| --- | --- | --- | --- | --- | --- |
| Money/math | `src/utils/math-engine.ts` | keep temporarily | `@noorix/finance-core` | After frontend imports are migrated | Compatibility only. Do not add new formulas here. |
| Money/math | `backend/src/common/utils/math-engine.ts` | keep temporarily | `@noorix/finance-core` | After backend imports are migrated | Compatibility only. Do not add new formulas here. |
| API response | `src/utils/apiResponse.ts` | deprecate gradually | `src/services/core/apiHttp.ts` + `useApiQuery` / `useApiListQuery` / `useApiMutation` | After HR, Orders, Reports, Invoices mutations are migrated | Keep tests while callers remain. No new callers. |
| HR payroll net | `src/modules/HR/utils/hrCalculations/payroll.ts` | keep temporarily | `@noorix/finance-core` | After HR screens import finance-core directly | Wrapper exists to avoid a broad UI refactor. |
| HR payroll net | `backend/src/hr/hr-payroll-line-net.util.ts` | keep temporarily | `@noorix/finance-core` | After HR service imports are migrated | Wrapper exists to keep backend call sites stable. |

Next migration order:
1. API response helpers in HR mutations.
2. API response helpers in Orders hooks.
3. API response helpers in Reports and Invoices.
4. Direct imports from `@noorix/finance-core` where wrappers are now trivial.
5. Delete wrappers only when `rg` shows no production imports remain.

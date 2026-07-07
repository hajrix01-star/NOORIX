# NOORIX Source-of-Truth Governance Checklist

Purpose: make NOORIX's centralization rule auditable. Official accounting numbers must come from the backend, database snapshots, ledger, or shared core packages. The frontend may format, preview, filter, and compute display-only ratios, but it must not become the source of official financial truth.

## Executive Rule

| Rule | Status | Acceptance check |
| --- | --- | --- |
| Official accounting figures come from backend/core/ledger only | In force | Reports, invoices, vaults, VAT, payroll, EOS, and settlements are calculated or validated server-side |
| Frontend display calculations are allowed only for presentation | In force | Percentages, chart labels, filters, and previews are documented as display/draft only |
| Browser storage is not an official data source | In force | `localStorage` / `sessionStorage` may store preferences, drafts, tokens, or cache only |
| API access is centralized | In progress, strong coverage | Reads use `useApiQuery` / `useApiListQuery`; commands use `useApiMutation`; raw fetch is allowlisted |
| Duplicate business formulas are removed or wrapped | In progress | Official formulas live in `@noorix/finance-core`, backend services, `AccountingCore`, or VAT/reporting core |

## Source Classes

| Class | Allowed source | Examples | Frontend role |
| --- | --- | --- | --- |
| Official financial | Backend API, DB, ledger, `AccountingCore`, `TaxVatCoreService`, `@noorix/finance-core` | P&L, VAT official report, vault balances, payroll, EOS, invoice tax/net amounts | Display returned result; submit raw user inputs only |
| Operational analytic | Backend API rows or summaries | dashboard charts, top suppliers, orders analytics, bank slices | Filter, group, label, and show operational context where needed |
| Display-derived | Frontend helpers from backend values | profit margin, purchase ratio, daily average, chart percentages | Format and derive display ratios only |
| Draft/planning | Browser storage or editable worksheet | VAT planning worksheet, cost accounting draft slots | Must be visibly draft/manual/planning; not official accounting |
| Preferences/cache | Browser storage | table widths, hidden columns, theme, active company display preference | UX only; never permission or accounting authority |

## Implementation Checklist

### A. Official Accounting Numbers

- [x] P&L official totals remain ledger-first.
- [x] VAT official disclosure is centralized in `TaxVatCoreService`.
- [x] Payroll net/totals and EOS calculations are centralized through `@noorix/finance-core`.
- [x] Invoice outflow tax/net amounts are recomputed by backend, not trusted from the frontend.
- [x] Vault negative balance is allowed only as a ledger-derived result, not as a frontend fallback.
- [ ] Add or expand tenant/company isolation tests before public SaaS launch.
- [ ] Finish security dependency decision: fix high vulnerabilities or document risk acceptance.

### B. Frontend Display and Draft Rules

- [x] Shared display percentage helpers exist for P&L-style presentation ratios.
- [x] HR summary failure shows an error state instead of official-looking zeroes.
- [x] Tax/VAT planning remains draft/manual and does not replace official VAT core output.
- [ ] Add a small UI/data audit test for official screens that must not read official values from browser storage.
- [ ] Keep operational charts clearly distinguishable from official ledger reports.

### C. API Centralization

- [x] Raw `useQuery` / `useQueries` is restricted to the central API query hook file.
- [x] Raw `useMutation` is restricted to the central API mutation hook file.
- [x] `catch { return [] }` is forbidden for official frontend API reads, except documented local draft snapshots.
- [x] Legacy `rejectIfApiFailed` / `assertApiOk` helpers are blocked in scanned frontend source.
- [x] Raw frontend `fetch` is allowlisted to the central client plus download/probe/version flows.
- [ ] Move allowlisted raw `fetch` cases behind named wrappers where practical.
- [ ] Add backend outbound HTTP wrapper/allowlist for Gemini, Google backup, and health integrations.

### D. Duplicate and Compatibility Cleanup

- [x] `docs/COMPATIBILITY_DEPRECATION_PLAN.md` lists compatibility wrappers and replacements.
- [x] Frontend/backend math wrappers are documented as temporary compatibility layers.
- [x] HR payroll wrappers are documented as temporary compatibility layers.
- [x] HR closure is registered with system-wide centrality boundaries in `docs/SECTION_UNIFICATION_REGISTER.md`.
- [x] Reports closure is registered with query centrality, typed P&L/tax/bank/cost/detail boundaries, and print/export ownership boundaries.
- [ ] Migrate trivial wrapper callers directly to `@noorix/finance-core` when risk is low.
- [ ] Delete wrappers only after `rg` confirms no production imports remain.

### E. Section Centrality Readiness

- [x] Invoices, Purchases, Dashboard, Owner Dashboard, Sales, HR, and Reports have section entries in `docs/SECTION_UNIFICATION_REGISTER.md`.
- [x] HR has explicit final-system migration boundaries for official calculations, query contracts, employee display, documents, editable payroll rows, and draft previews.
- [x] HR final workspace audit passed on 2026-07-07: `npm run typecheck`, `npm run check:hr-governance`, and `npm test` with 131 files / 521 tests.
- [x] Reports workspace audit passed on 2026-07-07: `npm run typecheck`, `npm run check:reports-governance`, `npm run check:table-governance`, targeted Reports tests 11 files / 39 tests, and full `npm test` 134 files / 531 tests.
- [ ] Add the same final-system migration boundary table when closing each remaining section.
- [ ] Promote a repeated pattern into `src/ui`, shared services, or backend/core only after it appears in three or more closed sections and has a governance path.

### F. Done Definition

This file is complete for a release when:

- [ ] `npm run typecheck` passes.
- [ ] `npm test -- --run` passes.
- [ ] `npm run build` passes.
- [ ] `npm test --prefix backend` passes in a build environment with generated Prisma client.
- [ ] Source-of-truth guardrails pass in CI.
- [ ] Security audit is either fixed or accepted in a documented risk file.
- [ ] Tenant isolation tests cover cross-company read rejection, missing company rejection, disabled user refresh rejection, and role permission updates.

## Developer Rules

1. Do not add an official financial formula to a React component or hook.
2. Do not treat browser storage as a source of official accounting values.
3. Do not add raw `useQuery`, `useQueries`, `useMutation`, or `fetch` without updating the guardrail allowlist and documenting why.
4. Do not add new formulas to compatibility wrappers.
5. If a number is display-only, name it as display/ratio/preview/draft in code or documentation.
6. If a number affects saving, posting, closing, payroll, tax, VAT, ledger, vaults, or invoices, validate or compute it in backend/core.

# UI/Table Governance Closeout And Next RFC

Date: 2026-07-03

Status: decision document. No implementation is authorized by this document alone.

## Executive Decision

| Decision | Result |
|---|---|
| Safe UI/table governance phase | closed |
| Next work type | RFC-first, then one scoped implementation PR |
| Broad cleanup/refactor | stopped |
| Protected domains | payroll, tax, bank, purchases, financial reports stay protected |
| SmartTable direction | keep Noorix `SmartTable` as public API; use TanStack internally only |

## Evidence

| Check | Result |
|---|---|
| PR `#239` | merged |
| Main commit | `3f53069b076b04d1a5dcba6a901f5f269a02e358` |
| Main CI | passed |
| Deploy workflow | passed |
| Live build meta | `3f53069b076b04d1a5dcba6a901f5f269a02e358` |
| API readiness | `status: ok`, `dbConnected: true` |
| API liveness | `status: live` |

## Current Metrics

| Metric | Current |
|---|---:|
| Governed manual `<table>` outside `src/ui` | 53 |
| Files with governed manual tables | 33 |
| Raw `<table` outside `src/ui` by direct scan | 57 |
| `SmartTable` JSX usages | 46 |
| Files using `SmartTable` JSX | 36 |
| `SimpleTable` JSX usages | 23 |
| Files using `SimpleTable` JSX | 16 |
| `MatrixTable` production usages outside `src/ui` | 1 |
| `style={{` total | 10 |
| `style={{` inside `src/ui` | 0 |
| `style={{` outside `src/ui` | 10 |
| Raw `<button` outside `src/ui` | 1 |
| Raw input/select/textarea outside `src/ui` | 0 |
| `src/index.css` lines | 6160 |
| `src/ui/ui.css` lines | 1705 |

## Why 57 Raw Tables But 53 Governed Tables

| Count | Meaning |
|---:|---|
| 57 | direct `rg "<table"` outside `src/ui`, includes central print builder/test files |
| 53 | governed screen/module manual tables tracked in `scripts/table-manual-exceptions.json` |

The 53 count is the production governance number. The 57 count is useful only as a raw scan sanity check.

## Remaining Work Classification

| Work | Decision | Risk |
|---|---|---|
| SmartTable v2 compatibility | next RFC step | low if no API break |
| Bundle review after TanStack | required before expanding features | medium |
| MatrixTable hardening | after SmartTable compatibility audit | high |
| EditableTable RFC | required before editable grids | medium/high |
| Financial PrintTable RFCs | required per domain | high |
| Payroll/tax/bank/purchases conversions | deferred | critical |

## Next Phase: SmartTable Compatibility RFC

| Item | Required Output |
|---|---|
| API compatibility matrix | every current prop and behavior mapped |
| Test matrix | sorting, pagination, row numbers, footer, compact mode, mobile cards |
| Bundle decision | current cost and mitigation path |
| Rollback plan | adapter bypass/revert path without consumer changes |
| Scope boundary | no editable cells, no grouped rows, no protected financial conversions |

## Do First

| Priority | Work | Acceptance |
|---:|---|---|
| 1 | SmartTable compatibility audit | no source UI refactor |
| 2 | Add missing SmartTable adapter tests | tests pass locally and in CI |
| 3 | Bundle impact note | documented before merge |
| 4 | Decide phase 2 feature | sorting/pagination only, or stop |

## Do Not Do Yet

| Item | Reason |
|---|---|
| Convert `GeneralPlTable` | financial matrix; needs visual baseline |
| Convert payroll tables | protected HR financial domain |
| Convert tax tables | protected tax domain |
| Convert bank mapping/print tables | protected bank workflow |
| Convert purchases batch tables | protected purchase workflow |
| Add editable cells to SmartTable | belongs to EditableTable RFC |
| Add grouped/tree rows to SmartTable | depends on financial hierarchy decision |

## Acceptance For The Next PR

| Check | Required |
|---|---|
| `npm.cmd run test -- SmartTable` | pass |
| `npm.cmd run typecheck` | pass |
| `npm.cmd run check:table-governance` | pass |
| `npm.cmd run check:inline-style-governance` | pass |
| `npm.cmd run check:css-governance` | pass |
| `npm.cmd run check:control-governance` | pass |
| `npm.cmd run build` | pass if implementation changes source code |
| No protected-domain source files changed | yes |
| No merge/deploy until PR CI is green | yes |

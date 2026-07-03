# Frontend Remaining UI Governance Closure

Date: 2026-07-03

Status: safe cleanup closed. Future changes require RFC or targeted implementation.

## Final Counts

| Area | Count | Decision |
|---|---:|---|
| React `style={{` total | 29 | governed |
| Inside `src/ui` | 19 | UI-core runtime contracts |
| Outside `src/ui` | 10 | protected or deferred runtime exceptions |
| Files with inline styles | 15 | every remaining file has a reason |
| Non-protected screen inline styles outside `src/ui` | 0 | closed |
| Manual `<table>` outside `src/ui` | governed by table baseline | classified separately |
| Files with manual tables outside `src/ui` | governed by table baseline | classified separately |

## Remaining Inline Categories

| Category | Examples | Decision |
|---|---|---|
| Popover positioning | `KebabMenu` | leave in UI core |
| UI-core table sizing | `SmartTable`, `SimpleTable`, `MatrixTable` | leave until component RFC |
| Chart/data colors | bank/report analysis | leave protected |
| Financial matrix runtime tone | `GeneralPlTable` | leave |
| Protected domain runtime styles | purchases, bank, financial reports | leave until domain ticket |

## Closed Items

| Item | Closure |
|---|---|
| Raw inline-style cleanup | safe screen usages reduced to zero outside protected/deferred files |
| Remaining inline-style audit | `scripts/inline-style-manual-reasons.json` |
| CSS footprint | latest helper classes compacted |
| CI protection | inline, CSS, table, and control governance |
| Table exception classification | `docs/FRONTEND_TABLE_GOVERNANCE_STATUS.md` |

## Not In Scope For Safe Cleanup

| Item | Reason |
|---|---|
| Replacing `SmartTable` runtime styles | public API and tests rely on dynamic sizing/padding |
| Replacing `SimpleTable`/`MatrixTable` runtime styles | central table components intentionally own sizing/tone exceptions |
| Removing protected chart/runtime colors | remaining values are in bank/report/purchases protected areas |
| Rewriting popover positioning | remaining positioning is in UI core and requires visual testing |
| Converting financial matrix backgrounds | protected financial report readability |

## Current Remaining Files

| File | Count | Decision |
|---|---:|---|
| `src/ui/SmartTable/SmartTable.tsx` | 7 | UI core; SmartTable v2 RFC only |
| `src/ui/MatrixTable.tsx` | 5 | UI core; financial matrix boundary |
| `src/ui/SimpleTable.tsx` | 4 | UI core; sizing/column contract |
| `src/modules/Reports/GeneralPlTable.tsx` | 2 | protected financial matrix |
| `src/modules/Purchases/batch/components/PurchasesBatchToolbar.tsx` | 1 | protected purchases |
| `src/modules/Reports/BankStatementMappingModal.tsx` | 1 | protected bank preview |
| `src/modules/Reports/ReportsDetailModal.tsx` | 1 | protected report chart payload |
| `src/modules/Reports/bank/BankCategoryCardRow.tsx` | 1 | protected bank category color |
| `src/modules/Reports/bank/components/analysis/BankAnalysisCardShell.tsx` | 1 | protected bank progress |
| `src/modules/Reports/bank/components/analysis/BankAnalysisCategoryBarCard.tsx` | 1 | protected bank chart dimension |
| `src/modules/Reports/bank/components/analysis/BankAnalysisCategoryPieCard.tsx` | 1 | protected bank chart color |
| `src/modules/Reports/bank/components/analysis/BankAnalysisPieTooltip.tsx` | 1 | protected bank tooltip color |
| `src/ui/KebabMenu.tsx` | 1 | UI core positioning |
| `src/ui/MetricCard.tsx` | 1 | UI core custom color API |
| `src/ui/SmartTable/buildFooterCells.tsx` | 1 | UI core table footer |

## Next Decision

| Candidate | Decision |
|---|---|
| More screen cleanup | closed; no safe non-protected files remain |
| SmartTable v2/TanStack | RFC and compatibility pilot only |
| MatrixTable hardening | possible next implementation, but only with visual baseline |
| Bank/report/purchases inline styles | protected domain tickets only |
| CSS/theme cleanup | separate batch by CSS section, not mixed with table/UI core |

## Acceptance

| Check | Required Result |
|---|---|
| `npm.cmd run check:inline-style-governance` | passed |
| `npm.cmd run check:css-governance` | passed |
| `npm.cmd run check:control-governance` | passed |
| `npm.cmd run check:table-governance` | passed |
| CI build/tests | passed before deploy |

## Fresh Verification

| Check | Required Result |
|---|---|
| `npm.cmd run check:inline-style-governance` | pass |
| `npm.cmd run check:control-governance` | pass |
| `npm.cmd run check:table-governance` | pass |
| `npm.cmd run check:css-governance` | pass |


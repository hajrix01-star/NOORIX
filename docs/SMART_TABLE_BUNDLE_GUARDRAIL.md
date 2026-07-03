# SmartTable Bundle Guardrail

Date: 2026-07-04

Status: active guardrail after internal TanStack sorting/pagination state and navigation guard bridge.

## Decision

TanStack remains accepted only as the hidden `SmartTable` row/column engine. Do not enable additional TanStack features unless this document is updated with fresh bundle evidence and an explicit mitigation decision.

## Current Build Snapshot

| Artifact | Raw | Gzip | Notes |
|---|---:|---:|---|
| main app chunk `assets/index-*.js` | 458.95 kB | 149.69 kB | includes hidden TanStack adapter plus controlled sorting/pagination state, navigation guards, and isolated column-visibility panel |
| `vendor-*.js` | 165.74 kB | 53.96 kB | unchanged shared vendor chunk |
| `query-*.js` | 45.63 kB | 13.80 kB | unchanged query chunk |
| `src/ui/SmartTable/SmartTable.tsx` source size | 519 lines | n/a | pagination UI and column visibility UI extracted; keep reducing central file responsibility |
| `src/ui/SmartTable/SmartTablePagination.tsx` source size | 51 lines | n/a | isolated internal pagination bar |
| `src/ui/SmartTable/SmartTableColumnVisibility.tsx` source size | 147 lines | n/a | isolated internal column visibility button, portal, and placement logic |
| `src/ui/SmartTable/tableEngine.ts` source size | 178 lines | n/a | TanStack adapter state and navigation guards now centralized here |

## Guardrail

| Rule | Required |
|---|---|
| No unexplained main chunk growth | yes |
| No new TanStack feature activation without tests | yes |
| No grouping/tree/editable feature inside `SmartTable` core yet | yes |
| Heavy features must be evaluated for lazy loading | yes |
| Protected financial/report tables stay out of bundle-driven refactors | yes |

## Allowed Next Moves

| Move | Condition |
|---|---|
| Add engine tests | allowed |
| Add compatibility tests | allowed |
| Move sorting internals to TanStack | done for controlled state only; external API unchanged |
| Move pagination internals to TanStack | done for controlled state only; external API unchanged |
| Add grouped rows/editable cells | not allowed here; requires separate RFC |

## Verification Commands

| Command | Required Result |
|---|---|
| `npm.cmd run test -- SmartTable` | pass |
| `npm.cmd run typecheck` | pass |
| `npm.cmd run build` | pass |
| `npm.cmd run check:table-governance` | pass |
| `npm.cmd run check:inline-style-governance` | pass |
| `npm.cmd run check:css-governance` | pass |
| `npm.cmd run check:control-governance` | pass |

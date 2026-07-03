# SmartTable Bundle Guardrail

Date: 2026-07-04

Status: active guardrail after internal TanStack sorting/pagination state and navigation guard bridge.

## Decision

TanStack remains accepted only as the hidden `SmartTable` row/column engine. Do not enable additional TanStack features unless this document is updated with fresh bundle evidence and an explicit mitigation decision.

## Current Build Snapshot

| Artifact | Raw | Gzip | Notes |
|---|---:|---:|---|
| main app chunk `assets/index-*.js` | 460.78 kB | 150.18 kB | includes hidden TanStack adapter plus controlled sorting/pagination state, navigation guards, isolated header/states/responsive rows, column visibility, resize state, and style builders |
| `vendor-*.js` | 165.74 kB | 53.96 kB | unchanged shared vendor chunk |
| `query-*.js` | 45.63 kB | 13.80 kB | unchanged query chunk |
| `src/ui/SmartTable/SmartTable.tsx` source size | 365 lines | n/a | below large-file warning target after extracting pagination, header, states, responsive rows, column visibility, resize, and style responsibilities |
| `src/ui/SmartTable/SmartTableHeader.tsx` source size | 67 lines | n/a | isolated title/search/column visibility header |
| `src/ui/SmartTable/SmartTableStates.tsx` source size | 38 lines | n/a | isolated error and loading states |
| `src/ui/SmartTable/SmartTableResponsiveRows.tsx` source size | 83 lines | n/a | isolated compact and mobile-card renderers |
| `src/ui/SmartTable/SmartTablePagination.tsx` source size | 51 lines | n/a | isolated internal pagination bar |
| `src/ui/SmartTable/SmartTableColumnVisibility.tsx` source size | 147 lines | n/a | isolated internal column visibility button, portal, and placement logic |
| `src/ui/SmartTable/useSmartTableColumnResize.ts` source size | 60 lines | n/a | isolated column resize state and pointer handling |
| `src/ui/SmartTable/useSmartTableColumnVisibility.ts` source size | 56 lines | n/a | isolated column visibility persistence and derived columns |
| `src/ui/SmartTable/smartTableStyles.ts` source size | 143 lines | n/a | isolated CSS variable builders |
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

# SmartTable Bundle Guardrail

Date: 2026-07-04

Status: active guardrail after internal TanStack sorting/pagination state bridge.

## Decision

TanStack remains accepted only as the hidden `SmartTable` row/column engine. Do not enable additional TanStack features unless this document is updated with fresh bundle evidence and an explicit mitigation decision.

## Current Build Snapshot

| Artifact | Raw | Gzip | Notes |
|---|---:|---:|---|
| main app chunk `assets/index-*.js` | 458.26 kB | 149.46 kB | includes hidden TanStack adapter plus controlled sorting/pagination state |
| `vendor-*.js` | 165.74 kB | 53.96 kB | unchanged shared vendor chunk |
| `query-*.js` | 45.63 kB | 13.80 kB | unchanged query chunk |
| `src/ui/SmartTable/SmartTable.tsx` source size | 642 lines | n/a | large central UI file; avoid feature creep |
| `src/ui/SmartTable/tableEngine.ts` source size | 161 lines | n/a | TanStack adapter state now centralized here |

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

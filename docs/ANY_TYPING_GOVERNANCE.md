# Any Typing Governance

Date: 2026-07-09

Status: governed baseline; new explicit TypeScript `any` is blocked unless the baseline is intentionally updated.

## Current Counts

| Metric | Count |
|---|---:|
| Explicit TypeScript `any` baseline | 0 |
| Files with explicit `any` baseline | 0 |

## Decision

The baseline counts explicit TypeScript `any` after stripping string literals and `expect.any(...)` assertions. Business values such as `'any'` filters, English text, translations, and visible UI copy are not counted.

Cleaning is phased. When a file is cleaned, lower its count in `scripts/any-typing-baseline.json` in the same change.

## Priority

| Priority | Scope | Reason |
|---|---|---|
| 1 | `excelExportImport.ts`, `importTemplates.ts` | external Excel/CSV data boundary |
| 2 | `src/ui/SmartTable/*` | shared table primitive used across many screens |
| 3 | `useTableFilter.ts`, `reportDrillLinks.ts` | shared filtering/navigation helpers |
| 4 | small UI/component props | readability and gradual tightening |

## Governance

| File | Role |
|---|---|
| `scripts/any-typing-baseline.json` | exact allowed explicit `any` count per file |
| `scripts/check-any-typing-governance.mjs` | blocks new/stale explicit `any` counts |
| `docs/ANY_TYPING_GOVERNANCE.md` | source-of-truth plan for phased `any` cleanup |

Acceptance command: `npm.cmd run check:any-governance`.

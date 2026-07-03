# Frontend Table Governance Status

Date: 2026-07-03

Status: governed; no new raw table is allowed without registry count and reason.

## Current Counts

| Metric | Count |
|---|---:|
| Manual `<table>` outside `src/ui` | 69 |
| Files with manual tables outside `src/ui` | 46 |
| `SmartTable` JSX usages | 46 |
| Files using `SmartTable` JSX | 36 |
| `SimpleTable` JSX usages | 22 |
| Files using `SimpleTable` JSX | 15 |

## Classified Manual Tables

| Category | Files | Tables | Decision |
|---|---:|---:|---|
| `print-export-html` | 12 | 15 | leave until `PrintTable` phase |
| `print-financial` | 7 | 15 | protected financial print/export |
| `document-print` | 4 | 11 | leave fixed document layout |
| `editable-grid` | 6 | 6 | leave until editable table/control phase |
| `payroll-protected` | 4 | 6 | protected HR financial scope |
| `financial-report` | 3 | 4 | protected report scope |
| `tax-protected` | 2 | 3 | protected tax scope |
| `tax-print` | 1 | 2 | leave until `PrintTable` phase |
| `matrix-table` | 2 | 2 | leave until `MatrixTable` phase |
| `bank-print` | 1 | 1 | leave until `PrintTable` phase |
| `bank-protected` | 1 | 1 | protected bank workflow |
| `dashboard-matrix` | 1 | 1 | leave until `MatrixTable` phase |
| `hr-financial` | 1 | 1 | protected HR financial scope |
| `purchases-protected` | 1 | 1 | protected purchases workflow |

## Next Target

| Phase | Target | Acceptance |
|---|---|---|
| PrintTable Foundation | Central print/export HTML table builder | `src/utils/pdfTableExport.ts` routes through `src/utils/printTableHtml.ts` |
| PrintTable Conversion | Convert only safe plain print/export tables | classification required; protected financial/tax/payroll/bank/purchases tables stay untouched |
| MatrixTable RFC | Define wide financial/dashboard matrix rules | P&L, owner, dashboard matrices stay protected |
| Editable table controls | Define editable cells and row actions | no payroll/purchases conversion without tests |
| Safe conversion pass | Only non-financial display tables with no inputs, no print, no rowspan/colspan | `check:table-governance` stays green |

## Governance

| File | Role |
|---|---|
| `scripts/table-manual-exceptions.json` | exact allowed manual table count per file |
| `scripts/table-manual-reasons.json` | category, decision, and reason for every exception |
| `scripts/check-table-governance.mjs` | blocks new/stale/undocumented manual tables and unknown categories/decisions |
| `docs/PRINT_TABLE_FOUNDATION.md` | defines the governed print-table foundation and no-touch scope |

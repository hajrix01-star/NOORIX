# Frontend Table Governance Status

Date: 2026-07-07

Status: governed; no new raw table is allowed without registry count and reason.

## Current Counts

| Metric | Count |
|---|---:|
| Manual `<table>` outside `src/ui` | 32 |
| Files with manual tables outside `src/ui` | 19 |
| `SmartTable` JSX usages | 46 |
| Files using `SmartTable` JSX | 36 |
| `SimpleTable` JSX usages | 23 |
| Files using `SimpleTable` JSX | 16 |
| `MatrixTable` JSX usages | 1 |
| Files using `MatrixTable` JSX | 1 |

## Classified Manual Tables

| Category | Files | Tables | Decision |
|---|---:|---:|---|
| `document-print` | 4 | 11 | leave fixed document layout |
| `print-financial` | 2 | 7 | protected financial print/export |
| `editable-grid` | 6 | 6 | leave until editable table/control phase |
| `payroll-protected` | 2 | 3 | protected HR financial scope |
| `financial-report` | 2 | 2 | protected report scope |
| `tax-protected` | 2 | 2 | protected tax scope |
| `bank-protected` | 1 | 1 | protected bank workflow |
| `matrix-table` | 1 | 1 | leave until `MatrixTable` phase |
| `purchases-protected` | 1 | 1 | protected purchases workflow |

## Next Target

| Phase | Target | Acceptance |
|---|---|---|
| PrintTable Foundation | Central print/export HTML table builder | `src/ui/PrintPreviewModal.tsx` previews documents built with `src/utils/printTableHtml.ts` |
| PrintTable Conversion Batch 1 | Convert safe plain print/export tables | 7 manual tables removed; protected financial/tax/payroll/bank/purchases tables stay untouched |
| PrintTable Conversion Batch 2 | Convert remaining safe print/export tables | 4 manual tables removed; calendar/catalog/payroll special layouts stay untouched |
| SimpleTable Dashboard Conversion | Convert non-financial dashboard comparison table | 1 manual dashboard matrix table removed |
| Catalog PrintTable Conversion | Convert catalog print sheets through central complex print builder | 2 manual catalog tables removed |
| Dashboard Calendar PrintTable Conversion | Convert calendar print matrix through central complex print builder | 1 manual calendar print table removed |
| MatrixTable RFC | Define wide financial/dashboard matrix rules | P&L, owner, dashboard matrices stay protected |
| MatrixTable Owner Conversion | Convert safest owner monthly matrix | 1 manual matrix table removed; financial/P&L/payroll/tax/bank/purchases stay untouched |
| PrintTable Conversion Batch 3 | Convert safe print/export tables in reports, treasury, bank, and tax print model | 11 manual tables removed; official numbers and calculations stay untouched |
| HR Protected Print Conversion | Convert safe HR payroll/settlement print tables | 4 manual tables removed; editable payroll and signature slips stay protected |
| Hajri Tax Print Conversion | Convert Hajri tax print/export tables to central print builder | 2 manual tables removed; tax registry screen stays protected |
| Editable table controls | Define editable cells and row actions | no payroll/purchases conversion without tests |
| Safe conversion pass | Only non-financial display tables with no inputs, no print, no rowspan/colspan | `check:table-governance` stays green |

## Governance

| File | Role |
|---|---|
| `scripts/table-manual-exceptions.json` | exact allowed manual table count per file |
| `scripts/table-manual-reasons.json` | category, decision, and reason for every exception |
| `scripts/check-table-governance.mjs` | blocks new/stale/undocumented manual tables and unknown categories/decisions |
| `docs/PRINT_TABLE_FOUNDATION.md` | defines the governed print-table foundation and no-touch scope |
| `docs/PRINT_TABLE_CONVERSION_BATCH_1.md` | records the first safe PrintTable conversion batch |
| `docs/PRINT_TABLE_CONVERSION_BATCH_2.md` | records the second safe PrintTable conversion batch |
| `docs/SIMPLE_TABLE_DASHBOARD_CONVERSION.md` | records the safe dashboard SimpleTable conversion |
| `docs/CATALOG_PRINT_TABLE_CONVERSION.md` | records the catalog print-table conversion |
| `docs/DASHBOARD_CALENDAR_PRINT_TABLE_CONVERSION.md` | records the dashboard calendar print-table conversion |
| `docs/TABLE_NEXT_PHASE_RFC.md` | defines the next MatrixTable/EditTable/financial-print phase boundaries |
| `docs/MATRIX_TABLE_OWNER_CONVERSION.md` | records the first MatrixTable conversion |
| `docs/PRINT_TABLE_CONVERSION_BATCH_3.md` | records the third safe print/export conversion batch |
| `docs/HR_PROTECTED_PRINT_TABLE_CONVERSION.md` | records the safe HR protected print-table conversion |
| `docs/HAJRI_TAX_PRINT_TABLE_CONVERSION.md` | records the Hajri tax print-table conversion |

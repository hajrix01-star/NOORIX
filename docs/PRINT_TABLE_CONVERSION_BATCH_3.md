# Print Table Conversion Batch 3

Date: 2026-07-08

Status: closed locally pending user commit.

## Scope

Converted safe print/export table bodies to the central `buildPrintHtmlTable` helper:

- `src/modules/Treasury/components/VaultTransactionsModal.tsx`
- `src/modules/Reports/ReportsScreen.tsx`
- `src/modules/Reports/ReportsDetailModal.tsx`
- `src/modules/Reports/taxReportTabModel.ts`
- `src/modules/Reports/costAccountingApps/costAccountingAppsScreenActions.ts`
- `src/modules/Reports/bank/bankStatementExportPrint.ts`
- `src/modules/Reports/generalReportV2Model.ts`
- `src/modules/Reports/reportsPlMonthPrint.ts`

## What Changed

- Removed 11 manual `<table>` usages from governed print/export surfaces.
- Removed local print-cell escaping helpers from converted files.
- Kept all official numbers, tax values, P&L values, and vault totals on their existing data/model sources.
- Centralized print table escaping, alignment, empty rows, footer rows, and section rows through `src/utils/printTableHtml.ts`.

## Protected Boundaries

- No official accounting or tax formula was moved in this batch.
- No editable grid or protected payroll/purchases document table was touched.
- Remaining financial print bodies stay governed in `scripts/table-manual-exceptions.json` and `scripts/table-manual-reasons.json`.

## Closure Checks

- `tsc --noEmit`
- `check:table-governance`
- `check:print-export-governance`
- `check:system-governance-consolidated`
- `check-node-scripts`
- `git diff --check`

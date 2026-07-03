# Catalog PrintTable Conversion

Date: 2026-07-03

Status: implemented; operational catalog print sheets only.

## Counts

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Manual `<table>` outside `src/ui` | 57 | 55 | -2 |
| Files with manual tables outside `src/ui` | 37 | 35 | -2 |
| `print-export-html` files | 4 | 2 | -2 |
| `print-export-html` tables | 4 | 2 | -2 |

## Converted

| File | Tables removed | Central path |
|---|---:|---|
| `src/modules/Orders/utils/itemsCatalogPrint.ts` | 1 | `buildPrintHtmlTable` |
| `src/modules/Orders/utils/itemsCatalogWeeklyPrint.ts` | 1 | `buildPrintHtmlTable` |

## Foundation Added

| File | Addition |
|---|---|
| `src/utils/printTableHtml.ts` | complex print table rows with trusted HTML cells, `rowspan`, and `colspan` |
| `src/utils/printTableHtml.test.ts` | coverage for trusted HTML cells, `rowspan`, `colspan`, and escaped values |

## Left Untouched

| File | Reason |
|---|---|
| `src/modules/Dashboard/components/DashboardCalendarTab/hooks/useDashboardCalendarTab.ts` | calendar print matrix uses dynamic cell backgrounds |
| `src/modules/HR/tabs/PayrollTab.tsx` | payroll protected financial print scope |

## Verification

| Command | Result |
|---|---|
| `npm.cmd run test -- itemsCatalogPrint itemsCatalogWeeklyPrint printTableHtml` | passed |
| `npm.cmd run check:table-governance` | required |
| `npm.cmd run typecheck` | required |

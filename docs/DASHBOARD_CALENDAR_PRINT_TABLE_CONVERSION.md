# Dashboard Calendar PrintTable Conversion

Date: 2026-07-03

Status: implemented; dashboard calendar print matrix only.

## Counts

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Manual `<table>` outside `src/ui` | 55 | 54 | -1 |
| Files with manual tables outside `src/ui` | 35 | 34 | -1 |
| `print-export-html` files | 2 | 1 | -1 |
| `print-export-html` tables | 2 | 1 | -1 |

## Converted

| File | Tables removed | Central path |
|---|---:|---|
| `src/modules/Dashboard/components/DashboardCalendarTab/hooks/useDashboardCalendarTab.ts` | 1 | `buildPrintHtmlTable` |

## Notes

| Item | Decision |
|---|---|
| Dynamic calendar cell background | kept through central trusted `style` support in `buildPrintHtmlTable` |
| Day detail print table | already uses `buildPrintTableHtml` |
| Payroll print table | left untouched as protected HR financial scope |

## Verification

| Command | Result |
|---|---|
| `npm.cmd run typecheck` | passed before governance update |
| `npm.cmd run test -- printTableHtml itemsCatalogPrint itemsCatalogWeeklyPrint` | required |
| `npm.cmd run check:table-governance` | required |

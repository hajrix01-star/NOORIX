# PrintTable Conversion Batch 2

Date: 2026-07-03

Status: implemented; safe print/export HTML tables only.

## Counts

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Manual `<table>` outside `src/ui` | 62 | 58 | -4 |
| Files with manual tables outside `src/ui` | 41 | 38 | -3 |
| `print-export-html` files | 7 | 4 | -3 |
| `print-export-html` tables | 8 | 4 | -4 |

## Converted

| File | Tables removed | Scope |
|---|---:|---|
| `src/modules/Invoices/useInvoicesListActions.ts` | 1 | invoice list print table |
| `src/modules/Invoices/utils/buildInvoicesCashReportPrint.ts` | 1 | cash report vault table |
| `src/modules/Suppliers/components/SupplierProfileModal.tsx` | 2 | supplier profile key/value print tables |

## Left Untouched

| File | Reason |
|---|---|
| `src/modules/Dashboard/components/DashboardCalendarTab/hooks/useDashboardCalendarTab.ts` | calendar matrix cells use dynamic background styles |
| `src/modules/HR/tabs/PayrollTab.tsx` | payroll protected financial print scope |
| `src/modules/Orders/utils/itemsCatalogPrint.ts` | grouped catalog rows use category colspan |
| `src/modules/Orders/utils/itemsCatalogWeeklyPrint.ts` | weekly sheet uses rowspan/colspan headers |

## Verification

| Command | Expected |
|---|---|
| `npm.cmd run check:table-governance` | pass |
| `npm.cmd run typecheck` | pass |
| `npm.cmd run test -- printTableHtml` | pass |

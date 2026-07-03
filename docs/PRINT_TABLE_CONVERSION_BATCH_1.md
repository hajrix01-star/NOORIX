# PrintTable Conversion Batch 1

Date: 2026-07-03

Status: implemented.

## Result

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Manual `<table>` outside `src/ui` | 69 | 62 | -7 |
| Files with manual tables outside `src/ui` | 46 | 41 | -5 |
| `print-export-html` files | 12 | 7 | -5 |
| `print-export-html` tables | 15 | 8 | -7 |

## Converted Files

| File | Tables Removed | Notes |
|---|---:|---|
| `src/modules/Expenses/components/ExpenseLineDetailModal.tsx` | 1 | payment detail print table |
| `src/modules/Expenses/components/ExpenseLineList.tsx` | 1 | expense line print table |
| `src/modules/Expenses/components/PaymentHistoryTab.tsx` | 1 | payment history print table |
| `src/modules/Sales/hooks/useDailySalesScreen.ts` | 1 | daily sales summary print table |
| `src/modules/Dashboard/components/DashboardCalendarTab/hooks/useDashboardCalendarTab.ts` | 1 | day detail print table only |
| `src/modules/Orders/utils/ordersTabModel.ts` | 1 | single order print table |
| `src/modules/Suppliers/components/SupplierProfileModal.tsx` | 1 | supplier invoices print table |

## Left Intentionally

| File | Reason |
|---|---|
| `src/modules/Dashboard/components/DashboardCalendarTab/hooks/useDashboardCalendarTab.ts` | monthly calendar matrix uses dynamic cell colors |
| `src/modules/Orders/utils/itemsCatalogPrint.ts` | grouped catalog rows use category headers with colspan |
| `src/modules/Orders/utils/itemsCatalogWeeklyPrint.ts` | weekly sheet uses rowspan/colspan group headers |
| `src/modules/Suppliers/components/SupplierProfileModal.tsx` | profile key/value tables are document layout, not export tables |
| `src/modules/HR/tabs/PayrollTab.tsx` | payroll scope remains protected |
| `src/modules/Invoices/**` | invoice/cash-report print remains financial and production-sensitive |

## Acceptance

| Check | Requirement |
|---|---|
| TypeScript | `npm.cmd run typecheck` |
| Table governance | `npm.cmd run check:table-governance` |
| Print utility tests | `vitest run src/utils/printTableHtml.test.ts` |
| Source encoding | `vitest run src/sourceEncoding.test.ts` |
| Full safety close | `npm.cmd test` and `npm.cmd run build` before merge |

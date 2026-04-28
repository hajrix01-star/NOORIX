# Frontend refactor backlog

Large UI modules that remain monolithic and are candidates for **future** refactors.
This list is **documentation only** — no work is scheduled here by default.

Scan rule: files under `src/` with **more than 500 lines** (line count is approximate, `Measure-Object` / editor may differ by a few lines).

| File | Approx. lines | Area | Priority | Reason | Suggested next step |
|------|---------------|------|----------|--------|---------------------|
| `src/modules/Purchases/PurchasesBatchScreen.tsx` | 684 | Purchases | **High** | Central batch flow; size hurts review and regression risk | Extract batch table + filters + mutations into colocated hooks/components |
| `src/modules/Invoices/components/DayCloseReportModal.tsx` | 639 | Invoices / close | **High** | Report + print surface; long modal | Split report sections, print layout, and data fetch |
| `src/modules/Sales/DailySalesScreen.tsx` | 630 | Sales | **High** | Daily operations screen | Screen shell + day summary + line list as separate pieces |
| `src/i18n/translations/hr.ts` | 627 | i18n | **Low** | String data, not layout | Keep as data; split by domain only if maintainability suffers |
| `src/modules/HR/StaffListScreen.tsx` | 609 | HR | **High** | Main staff list; many concerns in one file | Table, filters, modals, and row actions in subcomponents |
| `src/modules/OcrInvoices/components/SuppliersCatalogTab.tsx` | 597 | OCR / suppliers | **Medium** | Large tab with list + actions | Tab layout + table + import side effects |
| `src/modules/Dashboard/components/DashboardCalendarTab.tsx` | 576 | Dashboard | **Medium** | Calendar + loads in one file | Calendar shell vs. event list vs. API hooks |
| `src/i18n/translations/reports.ts` | 575 | i18n | **Low** | Translation payload | Same as other locale blobs |
| `src/modules/HajriTax/HajriTaxScreen.tsx` | 567 | Hajri Tax | **Medium** | Compliance UI density | Careful extraction (domain rules are sensitive) |
| `src/modules/Orders/components/OrdersTab.tsx` | 562 | Orders | **Medium** | List + status work | List, filters, and order row components |
| `src/modules/HR/tabs/SalaryCalcTab.tsx` | 555 | HR / payroll | **High** | Salary logic + UI together | **Do not** change calculation rules; split UI vs. read-only formatters only with tests |
| `src/i18n/translations/common.ts` | 541 | i18n | **Low** | Shared strings | Optional split by feature key prefix |
| `src/modules/HR/tabs/AdvancesTab.tsx` | 539 | HR | **High** | Staff advances | Table + form + approval paths |
| `src/modules/Expenses/components/ExpenseFormModal.tsx` | 536 | Expenses | **Medium** | Complex modal | Sections: header, lines, VAT, attachments |
| `src/modules/Invoices/useInvoicesListScreen.ts` | 526 | Invoices | **Medium** | Hook-only mega-file | Split query keys, filters, and mutation helpers |
| `src/modules/HR/tabs/PayrollTab.tsx` | 525 | HR / payroll | **High** | Payroll surface area | Same caution as salary: UI decomposition without touching payroll math |
| `src/utils/importTemplates.ts` | 512 | Import/Export | **Low** | Static template definitions | Split by module (HR vs. inventory) when editing |

## Notes

- **EmployeeDocModal** — entry file `EmployeeDocModal.tsx` is a thin barrel; larger pieces live under `EmployeeDocModal/`. No single file in that tree exceeded 500 lines in the latest scan; revisit after substantive edits.
- **PayrollRunFormModal** — main modal `PayrollRunFormModal.tsx` is already split (~145 lines); heavy logic is in hooks/utils.
- **SmartChat** — `SmartChatScreen.tsx` is under 500 lines after recent moves; no backlog row required unless it grows again.
- **Bank (Reports)** — no `src` file under Reports/bank exceeded 500 lines in this scan; Bank-related UI may appear in future scans if files grow.
- **Assets** — no Assets module file exceeded 500 lines in this scan.

Last scan: 2026-04-28 (after HR Quick Entry + SmartTable typing pass).

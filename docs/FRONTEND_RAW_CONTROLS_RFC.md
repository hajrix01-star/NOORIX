# RFC: Remaining Raw Controls

Date: 2026-07-02

Status: accepted for planning, no production UI refactor in this RFC.

## 1. Current Numbers

| Metric | Before UI unification | After merged phase | Remaining decision |
|---|---:|---:|---|
| Raw form controls outside `src/ui` | 90 | 34 | classify before conversion |
| Raw buttons outside `src/ui` | 74 | 47 | handle by dedicated passes |
| Raw tables outside `src/ui` | 61 | 53 TSX | governed exceptions |
| `style={{` outside `src/ui` | 527 | 494 | separate CSS/theme phase |

Sources:

| File | Role |
|---|---|
| `scripts/control-manual-exceptions.json` | current allowed raw control counts |
| `scripts/control-manual-reasons.json` | category and reason for every raw control exception |
| `scripts/check-control-governance.mjs` | blocks new or undocumented raw controls |

## 2. Remaining Raw Form Controls

| Group | Count | Risk | Decision |
|---|---:|---|---|
| Financial edit forms: invoices, sales, expenses | 11 | high | convert only in financial-form pass |
| Purchases editable rows | 4 | high | wait for editable cell primitives |
| HR payroll, settlement, residency documents | 9 | high | convert only in HR/payroll pass |
| Tax/VAT | 3 | high | convert only in tax pass |
| Reports and cost accounting | 2 | high | convert only in report pass |
| Bank upload | 1 | high | leave until drag-and-drop upload primitive exists |
| Order editable grids | 4 | medium-high | wait for editable cell primitives |

Note: counts are grouped by workflow risk, so a file can belong to a protected product area even when the raw element itself is small.

## 3. Decision Table

| File | Raw count | Evidence lines | Type | Financial? | Editable? | Conversion decision |
|---|---:|---|---|---|---|---|
| `src/modules/Purchases/components/BatchRow.tsx` | 4 | 133, 189, 350, 394 | input | yes | yes | leave until `EditableNumberCell` and purchase tests |
| `src/modules/Invoices/components/InvoiceEditModal.tsx` | 2 | 278, 334 | input | yes | yes | leave until invoice edit pass |
| `src/modules/Sales/components/SalesDayEditModal.tsx` | 1 | 127 | input | yes | yes | leave until sales day edit pass |
| `src/modules/Expenses/components/ExpenseFormModal.tsx` | 3 | 392, 576, 589 | input | yes | yes | leave until expense form pass |
| `src/modules/Expenses/components/ExpenseLineFormModal.tsx` | 1 | 317 | input | yes | yes | leave until expense line pass |
| `src/modules/Expenses/components/ExpenseBatchTable.tsx` | 4 | 208, 254, 299, 367 | input | yes | yes | leave until editable expense grid pass |
| `src/modules/HR/tabs/HrPrintPayrollPanel.tsx` | 2 | 78, 171 | checkbox/input | yes | no | leave until payroll print pass |
| `src/modules/HR/components/TerminationSettlementModal.tsx` | 1 | 515 | input | yes | yes | leave until settlement pass |
| `src/modules/HR/components/AdvanceSettlementModal.tsx` | 1 | 96 | checkbox | yes | no | safe only in HR finance pass |
| `src/modules/HR/components/PayrollRunFormModal/components/PayrollRunRowsTable.tsx` | 2 | 52, 130 | input | yes | yes | leave until payroll editable grid pass |
| `src/modules/HR/components/PayrollRunDetailModal.tsx` | 1 | 274 | input | yes | no | leave until payroll detail pass |
| `src/modules/HR/components/ResidencyFormModal.tsx` | 1 | 322 | input | no | no | safe later in HR document pass |
| `src/modules/HR/components/EmployeeDocModal/components/FinalSettlementPreview.tsx` | 1 | 82 | checkbox | yes | no | leave until settlement document pass |
| `src/modules/HajriTax/HajriTaxDetailEditor.tsx` | 2 | 139, 345 | input | yes | yes | leave until VAT detail edit pass |
| `src/modules/Reports/TaxReportTab.tsx` | 1 | 196 | input | yes | no | leave until tax report pass |
| `src/modules/Reports/GeneralReportV2Screen.tsx` | 2 | 292, 345 | select/input | yes | no | leave until financial report controls pass |
| `src/modules/Reports/BankStatementUploadModal.tsx` | 1 | 151 | file | yes | no | leave until bank upload pass |
| `src/modules/Orders/StaffOrdersViewParts.tsx` | 2 | 83, 288 | input | no | yes | wait for editable order cell primitives |
| `src/modules/Orders/components/OrderFormModal.tsx` | 2 | 418, 585 | input | no | yes | wait for editable order cell primitives |

## 4. Missing UI Primitives

| Needed component | Status | Why it is needed | Unlocks |
|---|---|---|---|
| `EditableNumberCell` | added | repeated row-bound number inputs with min/max, disabled state, and compact layout | purchases, expenses, payroll, orders |
| `EditableTextCell` | added | compact row-bound text inputs without full form spacing | bank rules, editable grids |
| `EditableCheckboxCell` | added | checkbox in dense table/card rows without label wrapper shift | bank category, payment history, settlement toggles |
| `InlineSelect` | added | compact selects inside toolbars or rows | reports, cost accounting, bank filters |
| `FileTrigger` | added | hidden file input behind a custom Noorix button | tax import, bank upload, cost CSV import |

Primitive foundation delivered in `src/ui` with focused tests in `src/ui/EditableControlPrimitives.test.tsx`.

## 5. What To Convert First

| Priority | Scope | Files | Expected reduction | Required tests |
|---:|---|---|---:|---|
| 1 | safe checkbox-only controls with existing `Checkbox` | `PaymentHistoryTab.tsx`, `BankCategoryCardRow.tsx` | delivered | targeted render/smoke or manual workflow check |
| 2 | hidden file input pattern after `FileTrigger` exists | `HajriTaxScreen.tsx`, `HajriTaxBulkImportModal.tsx`, `CostAccountingAppsScreen.tsx` | delivered | upload trigger smoke, accepted file types |
| 3 | report toolbar controls after `InlineSelect` exists | `GeneralReportV2Screen.tsx`, `TaxReportTab.tsx` | 3 | report year/filter behavior |
| 4 | bank rules and filters | `BankCategoryRulesImportSheet.tsx`, `BankStatementTransactionsFullTab.tsx` | delivered | bank import/filter tests or smoke |
| 5 | editable financial grids | purchases, expenses, payroll, orders | 20+ | row edit tests, calculation tests, regression smoke |

Delivered safe checkbox pass:

| File | Change |
|---|---|
| `src/modules/Expenses/components/PaymentHistoryTab.tsx` | raw show-all-dates checkbox moved to `Checkbox` |
| `src/modules/Reports/bank/BankCategoryCardRow.tsx` | raw active checkbox moved to `EditableCheckboxCell` |

Delivered FileTrigger and inline controls pass:

| File | Change |
|---|---|
| `src/modules/HajriTax/HajriTaxScreen.tsx` | VAT JSON raw file input moved to `FileTrigger` |
| `src/modules/HajriTax/HajriTaxBulkImportModal.tsx` | bulk import raw file input moved to `FileTrigger` |
| `src/modules/Reports/CostAccountingAppsScreen.tsx` | CSV raw file input moved to `FileTrigger`; two selects moved to `InlineSelect`; VAT checkbox moved to `Checkbox` |

Delivered bank controls pass:

| File | Change |
|---|---|
| `src/modules/Reports/bank/components/BankCategoryRulesImportSheet.tsx` | import source and mode radios moved to `Radio`; JSON import trigger moved to `FileTrigger` |
| `src/modules/Reports/bank/BankStatementTransactionsFullTab.tsx` | select-all and row selection checkboxes moved to `Checkbox` |

## 6. What To Leave Temporarily

| Scope | Reason |
|---|---|
| Payroll and settlement controls | payroll calculations and official HR documents are high risk |
| Purchases and expense batch rows | editable financial grids need cell primitives first |
| Tax/VAT detail editing | production tax workflow, needs dedicated test pass |
| Cost accounting calculations/editable fields | financial analysis; do not touch calculation behavior in UI-only pass |
| Order quantity grids | quantity behavior is row-bound and should move with editable cell components |

## 7. Acceptance Criteria For Next Implementation Pass

| Condition | Verification |
|---|---|
| no new raw controls | `npm.cmd run check:control-governance` |
| no new raw tables | `npm.cmd run check:table-governance` |
| TypeScript clean | `npm.cmd run typecheck` |
| new primitives covered | `npx.cmd vitest run src/ui/ControlPrimitives.test.tsx` plus new primitive tests |
| protected files changed only by approved pass | `git diff --name-only` reviewed against this RFC |
| no broad CSS/theme refactor | diff contains no unrelated `index.css` or `ui.css` cleanup |

## 8. Recommendation

Decision: incremental refactor.

Reason: the remaining 49 raw controls are not random UI leftovers. They are mostly protected financial, payroll, bank, tax, or editable-grid controls. The next real improvement is to add the missing compact/editable primitives, then migrate one workflow at a time with tests.

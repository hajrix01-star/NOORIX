# RFC: Remaining Raw Controls

Date: 2026-07-02

Status: accepted for planning, no production UI refactor in this RFC.

## 1. Current Numbers

| Metric | Before UI unification | After merged phase | Remaining decision |
|---|---:|---:|---|
| Raw form controls outside `src/ui` | 90 | 0 | closed by central primitives |
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
| Financial edit forms: invoices, sales, expenses | 0 | closed | converted with `Input`, `Checkbox`, and `FileTrigger` |
| Purchases attachment inputs | 0 | closed | converted with `FileTrigger` |
| HR payroll and settlement documents | 0 | closed | converted with `Checkbox`, `Input`, and `FileTrigger` |
| Tax/VAT | 0 | closed | converted with `Checkbox` |
| Reports and cost accounting | 0 | converted | delivered in report toolbar pass |
| Bank upload | 0 | converted | delivered with `FileTrigger` while preserving dropzone trigger |
| Order editable grids | 0 | converted | delivered in order controls pass |

Note: counts are grouped by workflow risk, so a file can belong to a protected product area even when the raw element itself is small.

## 3. Decision Table

| File | Previous raw count | Evidence lines | Type | Financial? | Editable? | Conversion decision |
|---|---:|---|---|---|---|---|
| `src/modules/Purchases/components/BatchRow.tsx` | 2 | 187, 390 | file | yes | no | converted to `FileTrigger` |
| `src/modules/Invoices/components/InvoiceEditModal.tsx` | 2 | 278, 334 | input | yes | yes | converted to `FileTrigger` and `Checkbox` |
| `src/modules/Sales/components/SalesDayEditModal.tsx` | 1 | 127 | input | yes | yes | converted to `Input` |
| `src/modules/Expenses/components/ExpenseFormModal.tsx` | 3 | 392, 576, 589 | input | yes | yes | converted to `Checkbox` and `FileTrigger` |
| `src/modules/Expenses/components/ExpenseLineFormModal.tsx` | 1 | 317 | input | yes | yes | converted to `Checkbox` |
| `src/modules/Expenses/components/ExpenseBatchTable.tsx` | 2 | 295, 363 | checkbox | yes | no | converted to `Checkbox` |
| `src/modules/HR/components/TerminationSettlementModal.tsx` | 1 | 515 | input | yes | yes | converted to `FileTrigger` |
| `src/modules/HR/components/PayrollRunFormModal/components/PayrollRunRowsTable.tsx` | 2 | 52, 130 | input | yes | yes | converted to `Checkbox` |
| `src/modules/HR/components/PayrollRunDetailModal.tsx` | 1 | 274 | input | yes | no | converted to `Checkbox` |
| `src/modules/HajriTax/HajriTaxDetailEditor.tsx` | 2 | 139, 345 | input | yes | yes | converted to `Checkbox` |
| `src/modules/Reports/BankStatementUploadModal.tsx` | 1 | 151 | file | yes | no | converted to `FileTrigger` |

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
| 3 | report toolbar controls after `InlineSelect` exists | `GeneralReportV2Screen.tsx`, `TaxReportTab.tsx` | delivered | report year/filter behavior |
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

Delivered report toolbar controls pass:

| File | Change |
|---|---|
| `src/modules/Reports/TaxReportTab.tsx` | sales-inclusive VAT checkbox moved to `Checkbox` |
| `src/modules/Reports/GeneralReportV2Screen.tsx` | year selector moved to `InlineSelect`; row filter moved to `Input` |

Delivered HR checkbox controls pass:

| File | Change |
|---|---|
| `src/modules/HR/components/AdvanceSettlementModal.tsx` | salary deduction toggle moved to `Checkbox` |
| `src/modules/HR/components/EmployeeDocModal/components/FinalSettlementPreview.tsx` | include EOS toggle moved to `Checkbox` |
| `src/modules/HR/components/ResidencyFormModal.tsx` | issue invoice toggle moved to `Checkbox` |
| `src/modules/HR/tabs/HrPrintPayrollPanel.tsx` | allowance detail and annual month toggles moved to `Checkbox` |

Delivered order controls pass:

| File | Change |
|---|---|
| `src/modules/Orders/StaffOrdersViewParts.tsx` | basket and variant quantity inputs moved to `EditableNumberCell` |
| `src/modules/Orders/components/OrderFormModal.tsx` | product search moved to `Input`; add-item quantity moved to `EditableNumberCell` |

Delivered purchase and expense checkbox pass:

| File | Change |
|---|---|
| `src/modules/Purchases/components/BatchRow.tsx` | warranty follow-up toggles moved to `Checkbox`; receipt file inputs later moved to `FileTrigger` |
| `src/modules/Expenses/components/ExpenseBatchTable.tsx` | mobile exempt and warranty toggles moved to `Checkbox`; desktop toggles later moved to `Checkbox` |

Delivered raw form controls closure pass:

| File | Change |
|---|---|
| `src/modules/Sales/components/SalesDayEditModal.tsx` | transaction date moved to `Input` |
| `src/modules/Invoices/components/InvoiceEditModal.tsx` | receipt upload moved to `FileTrigger`; taxable toggle moved to `Checkbox` |
| `src/modules/HR/components/PayrollRunDetailModal.tsx` | net-only slip toggle moved to `Checkbox` |
| `src/modules/HR/components/TerminationSettlementModal.tsx` | hidden settlement document upload moved to `FileTrigger` |
| `src/modules/Reports/BankStatementUploadModal.tsx` | hidden bank statement upload input moved to `FileTrigger` |
| `src/modules/Expenses/components/ExpenseFormModal.tsx` | exempt, warranty, and receipt controls moved to central primitives |
| `src/modules/Expenses/components/ExpenseLineFormModal.tsx` | amount override toggle moved to `Checkbox` |
| `src/modules/Expenses/components/ExpenseBatchTable.tsx` | desktop exempt and warranty toggles moved to `Checkbox` |
| `src/modules/HR/components/PayrollRunFormModal/components/PayrollRunRowsTable.tsx` | include/defer payroll row toggles moved to `Checkbox` |
| `src/modules/HajriTax/HajriTaxDetailEditor.tsx` | VAT inclusive and simulator toggles moved to `Checkbox` |

## 6. What To Leave Temporarily

| Scope | Reason |
|---|---|
| Raw form controls | none remain outside `src/ui`; governance now blocks reintroduction |
| Payroll, settlement, purchase, expense, tax, and bank workflows | converted only at the control-shell level; calculation and save behavior must remain covered by workflow tests |
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

Reason: raw form controls are now closed at the screen layer, while raw buttons and raw tables still need incremental workflow-specific passes. The next real improvement is to migrate one remaining workflow at a time with focused tests.

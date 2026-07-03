# Table Next Phase RFC

Date: 2026-07-03

Status: RFC only. Do not implement conversions from this document until a separate implementation PR is approved.

## Goal

Close the next table-governance planning step after the safe PrintTable conversions. This RFC decides the order, no-touch scope, acceptance checks, and implementation boundaries for the remaining governed manual tables.

## Current Baseline

| Metric | Count |
|---|---:|
| Manual `<table>` outside `src/ui` | 54 |
| Files with manual tables outside `src/ui` | 34 |
| `SmartTable` JSX usages | 46 |
| Files using `SmartTable` JSX | 36 |
| `SimpleTable` JSX usages | 23 |
| Files using `SimpleTable` JSX | 16 |
| Remaining `print-export-html` tables | 1 |

## Remaining Table Families

| Family | Files | Tables | Risk | Decision |
|---|---:|---:|---|---|
| `print-financial` | 7 | 15 | high | leave until financial PrintTable RFC |
| `document-print` | 4 | 11 | medium | leave fixed document layout |
| `editable-grid` | 6 | 6 | high | require EditableTable RFC before conversion |
| `payroll-protected` | 4 | 6 | critical | no conversion in UI cleanup |
| `financial-report` | 3 | 4 | critical | require MatrixTable/financial-report RFC |
| `tax-protected` | 2 | 3 | critical | no conversion without tax acceptance tests |
| `tax-print` | 1 | 2 | critical | require tax PrintTable RFC |
| `matrix-table` | 2 | 2 | high | first candidate for MatrixTable RFC/prototype |
| `bank-print` | 1 | 1 | high | require bank print RFC |
| `bank-protected` | 1 | 1 | critical | no conversion in UI cleanup |
| `hr-financial` | 1 | 1 | high | leave until HR financial acceptance exists |
| `purchases-protected` | 1 | 1 | critical | no conversion in UI cleanup |
| `print-export-html` | 1 | 1 | critical | Payroll only; leave protected |

## Priority Order

| Priority | Work | Why First | Output |
|---:|---|---|---|
| 1 | MatrixTable RFC/prototype | unlocks P&L and owner/dashboard matrices without touching payroll/tax/bank | API, visual rules, one non-payroll prototype |
| 2 | EditableTable RFC | editable grids cannot safely fit `SmartTable`/`SimpleTable` as-is | cell/edit lifecycle contract |
| 3 | Financial PrintTable RFC | remaining print tables are financial/tax/bank/payroll sensitive | print-safe rules and acceptance tests |
| 4 | SmartTable v2 compatibility RFC | TanStack evaluation depends on knowing MatrixTable/EditTable boundaries | compatibility matrix and prototype criteria |
| 5 | Protected-domain conversion tickets | payroll, tax, bank, purchases | separate ticket per domain with owner review |

## MatrixTable Scope

### Candidate Files

| File | Tables | Current Category | Candidate Decision |
|---|---:|---|---|
| `src/modules/Reports/GeneralPlTable.tsx` | 1 | `matrix-table` | prototype only after visual baseline |
| `src/modules/Owner/components/OwnerMonthlyComparisonTable.tsx` | 1 | `matrix-table` | safer first prototype than P&L |
| `src/modules/Reports/CostAccountingAppsScreen.tsx` | 1 | `financial-report` | leave until financial-report phase |
| `src/modules/Reports/costAccountingApps/CostAccountingAppsResultPanels.tsx` | 1 | `financial-report` | leave until financial-report phase |
| `src/modules/Reports/GeneralReportV2Screen.tsx` | 2 | `financial-report` | leave until hierarchy and print rules exist |

### Required Capabilities

| Capability | Required For | Must Exist Before Conversion |
|---|---|---|
| Fixed first column | P&L/owner matrix labels | yes |
| Horizontal overflow shell | 12-month/wide reports | yes |
| Dense numeric cells | financial scanning | yes |
| Summary/total rows | financial totals | yes |
| Group/header rows | P&L hierarchy | yes |
| Heat/status cell styling | owner monthly comparison | yes |
| Print-safe mode | financial exports | before financial reports |
| Mobile fallback | narrow screens | before production rollout |

### MatrixTable Non-Goals

| Non-Goal | Reason |
|---|---|
| Editable cells | belongs to EditableTable RFC |
| Payroll calculations | protected payroll domain |
| Tax/VAT declaration layout | protected tax domain |
| Bank statement mapping | protected bank workflow |
| Replacing `SmartTable` | MatrixTable is for matrix reports only |

## EditableTable Scope

| Candidate File | Category | Why Not Now |
|---|---|---|
| `src/modules/HR/components/PayrollRunFormModal/components/PayrollRunRowsTable.tsx` | `editable-grid` | payroll calculations |
| `src/modules/Orders/StaffOrdersViewParts.tsx` | `editable-grid` | basket quantity editing |
| `src/modules/Orders/components/ItemsManageTabCategoriesSection.tsx` | `editable-grid` | inline category editing |
| `src/modules/Orders/components/OrderFormModal.tsx` | `editable-grid` | product/quantity/price editing |
| `src/modules/Orders/components/catalog/CatalogProductFormSheet.tsx` | `editable-grid` | variants select/number editing |
| `src/modules/Purchases/components/BatchEditPanel.tsx` | `editable-grid` | protected purchases editing |

### Required Contract

| Contract | Requirement |
|---|---|
| Cell primitives | use `EditableTextCell`, `EditableNumberCell`, `EditableCheckboxCell` |
| Validation | invalid/disabled/read-only states must be visible |
| Keyboard behavior | tab order and enter/escape rules documented |
| Row commit | define immediate vs staged save |
| Error recovery | row-level error display before conversion |
| Domain protection | payroll and purchases require separate owner acceptance |

## Financial PrintTable Scope

| Family | Decision |
|---|---|
| Payroll print/export | leave until Payroll Print RFC |
| Tax print/export | leave until Tax Print RFC |
| Bank print/export | leave until Bank Print RFC |
| Treasury print/export | leave until Treasury Print RFC |
| Day-close invoice print | leave until invoice/day-close visual acceptance exists |
| Cost accounting print | leave until financial-report Matrix/Print decision |

## SmartTable v2 Dependency

Do not start TanStack/SmartTable v2 implementation before these are true:

| Dependency | Required Evidence |
|---|---|
| MatrixTable boundary decided | this RFC accepted and a MatrixTable prototype approved |
| EditableTable boundary decided | EditableTable RFC accepted |
| Protected print boundary decided | payroll/tax/bank/financial PrintTable RFCs accepted |
| Compatibility tests exist | sorting, pagination, row numbers, footer, mobile cards |
| Rollback plan exists | old `SmartTable` remains available during prototype |

## Implementation Rules For Next PRs

| Rule | Required |
|---|---|
| One family per PR | yes |
| No payroll/tax/bank/purchases mixed with UI cleanup | yes |
| No raw table count increase | yes |
| Governance check green | yes |
| Visual before/after evidence for matrix tables | yes |
| Targeted tests for any new table component | yes |
| Full CI before merge | yes |
| Live deploy only after merge and green CI | yes |

## Proposed Phase Plan

| Phase | Scope | Expected Manual Table Reduction | Risk |
|---|---|---:|---|
| A | MatrixTable RFC acceptance and visual baseline | 0 | low |
| B | MatrixTable prototype on `OwnerMonthlyComparisonTable` | 1 | medium |
| C | MatrixTable hardening and optional `GeneralPlTable` prototype | 1 | high |
| D | EditableTable RFC and non-payroll prototype | 0-1 | medium |
| E | Financial PrintTable RFCs by domain | 0 | low |
| F | Protected domain conversions | case-by-case | high/critical |

## Acceptance For This RFC

| Check | Required Result |
|---|---|
| No source UI conversion | yes |
| No manual table count change | yes |
| `npm.cmd run check:table-governance` | pass |
| `git diff --check` | pass |
| Next implementation can start without reclassifying all tables | yes |

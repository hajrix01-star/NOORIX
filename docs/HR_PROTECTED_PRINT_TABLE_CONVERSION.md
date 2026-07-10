# HR Protected Print Table Conversion

Date: 2026-07-08

Status: closed locally pending user commit.

## Scope

Converted safe HR print-only tables to `buildPrintHtmlTable`:

- `src/modules/HR/tabs/payrollTabModel.ts`
- `src/modules/HR/tabs/salaryCalcPrint.ts`
- `src/modules/HR/components/terminationSettlementHelpers.ts`

## What Changed

- Removed 4 manual `<table>` usages from governed HR print surfaces.
- Centralized escaping, empty rows, alignment, and definition-style rows through `src/utils/printTableHtml.ts`.
- Kept payroll, salary, overtime, deduction, advance, and settlement calculations on their existing HR models.

## Protected Boundaries

- Payroll run editable rows remain protected under editable-grid governance.
- Payroll signature slips remain protected document-print output until a dedicated HR document table pass.
- No backend payroll, invoice, movement, or settlement logic was changed.

## Closure Checks

- `tsc --noEmit`
- `check:table-governance`
- `check:hr-governance`
- `check:system-governance-consolidated`
- `git diff --check`

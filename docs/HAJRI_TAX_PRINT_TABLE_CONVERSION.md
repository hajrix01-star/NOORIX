# Hajri Tax Print Table Conversion

Date: 2026-07-08

Status: closed locally pending user commit.

## Scope

Converted Hajri Tax print/export table bodies to `buildPrintHtmlTable`:

- `src/modules/HajriTax/useHajriTaxExports.ts`

## What Changed

- Removed 2 manual `<table>` usages from Hajri Tax print/export output.
- Centralized print escaping, tax section rows, numeric alignment, and registry print rows through `src/utils/printTableHtml.ts`.
- Kept tax planning and registry official numbers on the existing tax disclosure and registry metric models.

## Protected Boundaries

- `src/modules/HajriTax/HajriTaxRegistryList.tsx` remains a protected wide tax registry table.
- No tax calculation, registry payload, payment target, filing status, or export JSON logic was changed.

## Closure Checks

- `tsc --noEmit`
- `check:table-governance`
- `check:hajri-tax-governance`
- `check:system-governance-consolidated`
- `git diff --check`

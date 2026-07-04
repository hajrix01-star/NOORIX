# Noorix Interaction System Plan

Status: local implementation batch, no push, no merge, no deploy.

## Goal

Improve daily user experience by centralizing repeated interactions without replacing the Noorix UI kit.

## Decision

| Area | Decision |
| --- | --- |
| Noorix UI | Remains the official UI kit |
| shadcn/ui | Reference for composition, accessibility, and primitive patterns only |
| Date inputs | Use Noorix `DateField` instead of direct `Input type="date"` in safe screens |
| Date ranges | Use Noorix `DateRangeField` for from/to pairs |
| Period filters | Keep `DateFilterBar` behavior and migrate internals gradually |
| Date filter import path | Use `src/ui/date` as the official home for `DateFilterBar`, `DateFilterMonthPicker`, and `useDateFilter` |
| Date labels | Generate Gregorian month/weekday labels centrally via `src/ui/date/dateLocale.ts` |
| Date governance | Block new direct `type="date"` usage outside documented exceptions |
| Protected domains | Skip payroll, tax, bank, purchases, invoices, sales, expenses, treasury, and reports in this batch |

## Implemented Foundation

| Component | Purpose |
| --- | --- |
| `src/ui/date/DateField.tsx` | Central date input wrapper preserving `YYYY-MM-DD` values |
| `src/ui/date/DateRangeField.tsx` | Central from/to date wrapper with explicit end min boundary |
| `src/ui/date/DateFilterBar.tsx` | Official Noorix period filter bar used by screens |
| `src/ui/date/MonthPicker.tsx` | Central floating month picker behind the old `DateFilterMonthPicker` API |
| `src/ui/date/PeriodCalendars.tsx` | Central month/year/day range calendars used by `DateFilterBar` |
| `src/ui/date/DatePeriodControls.tsx` | Central period mode buttons, pending badge, and apply/reset actions |
| `src/ui/date/useFloatingPopover.ts` | Central fixed-position popover behavior with outside-click and Escape handling |
| `src/ui/date/dateLocale.ts` | Central Gregorian month/weekday labels without duplicated literals |
| `src/ui/date/datePeriodDraft.ts` | Central draft/apply/dirty/mode-change state helpers for period filters |
| `src/ui/date/DateField.test.tsx` | Unit coverage for emitted date values and range boundaries |
| `src/ui/date/datePeriodDraft.test.ts` | Unit coverage for period mode-change behavior |
| `src/ui/index.ts` | Exposes date components through the official UI kit |
| `src/shared/components/DateFilterBar.tsx` | Backward-compatible shim only; new imports should use `src/ui/date` |
| `scripts/check-date-control-governance.mjs` | Prevents new ungoverned `type="date"` usage |

## Migration Priority

| Priority | Scope | Decision |
| --- | --- | --- |
| 1 | `DateFilterBar` range fields | Convert now |
| 2 | Orders date fields | Convert now |
| 3 | SmartChat date filter | Convert now |
| 4 | Dashboard special days | Convert now |
| 5 | Assets dates | Convert now |
| 6 | Financial/protected modules | Defer |

## Current Deferred Date Baseline

| Scope | Decision |
| --- | --- |
| HR/payroll/EOS/leave | Defer to dedicated HR date workflow pass |
| Sales/invoices/expenses/treasury | Defer to financial date workflow pass |
| Purchases/batch | Defer to purchase import/batch date pass |
| Reports/bank | Defer to bank reconciliation date pass |

## Next RFC

Future work should extract a `CalendarPopover`, `MonthPicker`, and `YearPicker` from `DateFilterBar` only after this low-risk wrapper layer is stable.

## Test Cadence

| Stage | Verification |
| --- | --- |
| During a large local batch | Use code inspection and targeted `rg` only |
| End of the batch | Run typecheck, targeted tests, governance checks, and build once |
| Before push/merge/deploy | Repeat the full verification gate |

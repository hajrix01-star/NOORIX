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
| Protected domains | Skip payroll, tax, bank, purchases, invoices, sales, expenses, treasury, and reports in this batch |

## Implemented Foundation

| Component | Purpose |
| --- | --- |
| `src/ui/date/DateField.tsx` | Central date input wrapper preserving `YYYY-MM-DD` values |
| `src/ui/date/DateRangeField.tsx` | Central from/to date wrapper with explicit end min boundary |
| `src/ui/date/DateField.test.tsx` | Unit coverage for emitted date values and range boundaries |
| `src/ui/index.ts` | Exposes date components through the official UI kit |

## Migration Priority

| Priority | Scope | Decision |
| --- | --- | --- |
| 1 | `DateFilterBar` range fields | Convert now |
| 2 | Orders date fields | Convert now |
| 3 | SmartChat date filter | Convert now |
| 4 | Dashboard special days | Convert now |
| 5 | Assets dates | Convert now |
| 6 | Financial/protected modules | Defer |

## Next RFC

Future work should extract a `CalendarPopover`, `MonthPicker`, and `YearPicker` from `DateFilterBar` only after this low-risk wrapper layer is stable.

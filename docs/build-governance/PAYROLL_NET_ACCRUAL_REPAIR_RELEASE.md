# Payroll net-accrual repair — release governance

## G0 — contract

- Scope: one completed payroll run only: company `وقت الكرك`, run `PR-2605-001`, payroll month April 2026.
- Proven source facts: payroll cost is 19,266.6700; the already-posted non-cash advance settlement is 9,050.0000; the missing net salary payable is 10,216.6700.
- User decision: the net salary is genuinely payable and may be recorded as an accrual.
- Explicit exclusions: no cash or vault movement, no salary invoice, no supplier/customer document, no employee balance rewrite, and no change to the existing advance settlement.

## G1 — target design

The migration appends exactly one `payroll_accrual` ledger row for each positive-net payroll item:

- debit `EXP-004` (payroll expense);
- credit `PAY-001` (payroll payable);
- transaction date 2026-04-30; `vault_id` is null;
- total 10,216.6700, preserving the existing 9,050.0000 advance settlement.

## G2 — safety gate

Before a write, the migration requires one exact target, an open or absent fiscal period, active correctly typed accounts, eight payroll items, matching payroll equations and fixed totals, an already-complete advance settlement, zero prior payroll-accrual rows, and a null `payroll_accrued_at` marker. It locks the target and aborts the whole transaction on any mismatch.

## G3 — verification and release

Postconditions require the exact per-item ledger rows, exact total, no vault, no duplicate employee posting, an unchanged advance-settlement total, one audit row, and a non-null payroll-accrual marker. The deployment payroll gate must then pass before the frontend is published.

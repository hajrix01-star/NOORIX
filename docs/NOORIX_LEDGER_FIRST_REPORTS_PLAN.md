# NOORIX Ledger-First Reports Plan

## Rule

Official financial reports must prefer posted accounting records over UI-facing documents:

- `ledger_entries` is the source for official profit/loss, treasury balances, cash movement, and posted financial effects.
- `invoices`, `payments`, and domain documents are operational sources and may be used for drill-down details, labels, document numbers, and tax disclosure inputs.
- The UI must not recalculate official report totals independently.

## Current State

| Area | Current Source | Status |
|---|---|---|
| General P&L totals | `ledger_entries` via `loadAnnualLedgerAggregates` | compliant |
| Vault balances and movements | `ledger_entries` | compliant |
| P&L drill-down labels/details | Ledger entries joined to documents where possible, with invoice drill-down for category views | transitional |
| VAT disclosure | Official invoices aggregated once, calculated by `TaxVatCoreService` | centralized, not ledger-only |

## Why VAT Is Not Ledger-Only Yet

The VAT form needs tax disclosure buckets and policy switches such as `salesAmountIncludesVat`.
Those buckets are currently stored on official invoices, while the ledger records the posted financial effect.
Moving VAT to ledger-only requires explicit VAT ledger account taxonomy and reconciliation tests against historical returns.

## Safe Migration Checklist

1. Add ledger-account classification for VAT output/input accounts.
2. Build a parallel VAT report from ledger accounts without changing the existing endpoint.
3. Compare invoice-based VAT and ledger-based VAT for at least three closed historical periods.
4. Explain and fix any variance before switching the public report.
5. Switch report source only after tests prove equality or documented policy differences.

## Guardrails

- Do not silently substitute empty report data when company context or date filters are invalid.
- Do not use frontend calculations as an official report source.
- Do not enforce financial-period locking in this phase; it is intentionally deferred.

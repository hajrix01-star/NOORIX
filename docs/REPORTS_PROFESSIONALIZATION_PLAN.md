# Noorix Reports Professionalization Plan

## Scope

This plan upgrades the Noorix reports module in deliberate phases. Reports are display surfaces only; official accounting values must come from backend contracts, ledger/accounting services, and shared domain rules.

## Phases

1. **Unified reports UI**
   - Shared report header, filter toolbar, report container, export buttons, print buttons, empty/loading/error states, and table spacing.
   - Keep report-specific tables only when the accounting layout truly needs them, such as P&L monthly columns.

2. **Accounting Report Contract**
   - Define whether each report amount is net or VAT-inclusive.
   - General P&L uses VAT-inclusive amounts: sales 100 + VAT 15 is shown as 115.
   - Details disclose gross, net, VAT, source document, supplier/channel, and date.
   - The frontend must not recalculate official profit, expense, VAT, or margin values.

3. **Typed DTOs**
   - Replace report `any` usage with typed DTOs across API hooks, report helpers, and components.
   - Shared DTOs should describe report period, rows, groups, details, comparisons, and amount basis.

4. **Official report date filter**
   - Standardize year, month, multi-month, and date-range selection for accounting reports.
   - Support RTL/LTR and print/export period labels.

5. **Professional P&L levels**
   - Annual view is the default.
   - Month view is a separate tab.
   - Support summary, group, line-item, and detail levels.
   - Print/PDF/Excel must match the current level and period.
   - Clicking purchases or expenses opens backend-sourced invoice details that can be printed.

6. **Comparison reports**
   - Add Actual vs Previous Period, Gross Margin, Net Margin, EBITDA later, and monthly/quarterly comparisons.

7. **Official VAT report registry**
   - Move VAT report drafts into backend records that can be saved, approved, reviewed, and printed.

8. **Bank reconciliation center**
   - Treat bank statement analysis as a reconciliation center linked to reports, vaults, and invoices, not as a simple report tab.

9. **Fast and smart verification**
   - Use `rg` before editing to identify affected files and usages.
   - During development, run targeted tests only.
   - Prefer fast contract tests and pure-function tests for accounting rules.
   - Run `npm run build` once after the final edit.
   - Run full `npm test` only at the end when a change touches central financial/reporting contracts or before deploying a large change.

## Definition of Done for General P&L

- The report opens in annual mode by default.
- The annual table shows each month as its own column.
- Monthly mode is a clear tab with a single selected month.
- The P&L amount basis is explicit and VAT-inclusive.
- Details come from backend data and disclose gross/net/VAT.
- Each eligible line can open details and print them.
- Print/PDF/Excel match the selected level and period.
- Important report contracts are typed and tested.
- Build and the required targeted/full tests pass before deployment.

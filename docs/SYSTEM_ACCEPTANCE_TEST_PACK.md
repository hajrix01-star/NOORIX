# System Acceptance Test Pack

This pack is a local pre-production smoke cycle for the whole Noorix system.

It creates an isolated tagged scenario through the HTTP API, then verifies the source-of-truth database state and downstream reports.

## Run

Start the backend first, then run from the repository root:

```powershell
npm.cmd run acceptance:system
```

Optional environment variables:

```powershell
$env:ACCEPTANCE_API_BASE = "http://localhost:3000/api/v1"
$env:ACCEPTANCE_ADMIN_EMAIL = "admin@hajrix.com"
$env:ACCEPTANCE_ADMIN_PASSWORD = "Hajrim2h"
npm.cmd run acceptance:system
```

## Covered Flow

- Company VAT setting for sales.
- Payment vaults and one sales-channel vault.
- Suppliers.
- HR employee, allowance, penalty deduction, advance invoice, payroll run, payroll completion, and payroll payment.
- Sales summary where 115 inclusive sales becomes 100 net + 15 VAT.
- Purchase invoice, fixed expense invoice, variable expense invoice, and asset source invoice.
- Asset completion from invoice and warranty follow-up closeout.
- Vault transfer.
- Orders product/category/section and order entry.
- Invoice vault allocations.
- Ledger entries for outflow operations.
- P&L, VAT, period analytics, dashboard, owner overview, vaults, HR summary, and orders summary readback.

## Rule

The pack does not write official financial records directly to the database. Writes go through the API and therefore through the same backend services used by the app. Prisma is used only for readback verification.

## Expected Result

The script prints a JSON summary with:

- `tag`: the isolated acceptance scenario identifier.
- `period`: the payroll/reporting period used.
- `ids`: created entity ids.
- `checks.passed` and `checks.total`.
- `checks.failed`: empty when the system passes.

Any failed check exits with a non-zero code.

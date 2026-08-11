#!/usr/bin/env bash
# Verify that the historical payroll repair actually reached the accounting
# ledger.  This is intentionally read-only and fail-closed: a deployment must
# not claim payroll reporting is reconciled when a paid payroll run is still
# represented only by its net salary invoice.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(node -e "require('dotenv').config({path:'.env',quiet:true}); process.stdout.write(process.env.DATABASE_URL || '')")"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is unavailable; cannot verify payroll ledger reconciliation" >&2
  exit 1
fi

# Expected payroll cost is the approved employee entitlement after ordinary
# deductions (for example unpaid leave).  Employee advances are deliberately
# not subtracted: they reduce the cash paid, not the payroll expense.
#
# Actual cost is restricted to ledger rows that can be traced to the same run:
# salary invoices, the new payroll accrual, and advance-settlement deductions.
# The query blocks only a missing cost, by company and run, without changing
# invoices, employee advances, vaults, or ledger rows.  A historical excess
# can be a legitimate separately-recorded individual salary, so it must be
# reviewed rather than silently deleted or used to stop a safe repair.
read -r -d '' PAYROLL_SQL <<'SQL' || true
WITH paid_runs AS (
  SELECT
    pr.id AS payroll_run_id,
    pr.company_id,
    pr.run_number,
    pr.payroll_month,
    SUM(pri.gross_salary + pri.allowances_add - pri.deductions) AS expected_cost
  FROM payroll_runs pr
  JOIN payroll_run_items pri ON pri.payroll_run_id = pr.id
  WHERE pr.status = 'completed'
  GROUP BY pr.id, pr.company_id, pr.run_number, pr.payroll_month
), traced_ledger AS (
  SELECT DISTINCT
    paid.payroll_run_id,
    le.id,
    le.amount
  FROM paid_runs paid
  JOIN accounts expense_account
    ON expense_account.company_id = paid.company_id
   AND expense_account.code = 'EXP-004'
   AND expense_account.type = 'expense'
  JOIN ledger_entries le
    ON le.company_id = paid.company_id
   AND le.debit_account_id = expense_account.id
   AND le.status = 'active'
  LEFT JOIN invoices salary_invoice
    ON salary_invoice.company_id = paid.company_id
   AND salary_invoice.id = le.reference_id
   AND salary_invoice.kind = 'salary'
   AND salary_invoice.status = 'active'
  LEFT JOIN employee_deductions advance_deduction
    ON advance_deduction.company_id = paid.company_id
   AND advance_deduction.id = le.reference_id
   AND advance_deduction.deduction_type = 'advance'
  WHERE
    (le.reference_type = 'payroll_accrual' AND le.reference_id = paid.payroll_run_id)
    OR (
      le.reference_type IN ('salary', 'invoice')
      AND salary_invoice.id IS NOT NULL
      AND (
        salary_invoice.batch_id = paid.payroll_run_id
        OR salary_invoice.invoice_number = 'SAL-' || paid.run_number
        OR STRPOS(COALESCE(salary_invoice.notes, ''), paid.run_number) > 0
      )
    )
    OR (
      le.reference_type = 'advance_settlement'
      AND advance_deduction.id IS NOT NULL
      AND STRPOS(COALESCE(advance_deduction.notes, ''), paid.run_number) > 0
    )
), actuals AS (
  SELECT payroll_run_id, COALESCE(SUM(amount), 0) AS actual_cost
  FROM traced_ledger
  GROUP BY payroll_run_id
)
SELECT
  c.name_ar AS company,
  paid.run_number,
  to_char(paid.payroll_month, 'YYYY-MM') AS payroll_month,
  paid.expected_cost,
  COALESCE(actuals.actual_cost, 0) AS ledger_cost,
  paid.expected_cost - COALESCE(actuals.actual_cost, 0) AS difference
FROM paid_runs paid
JOIN companies c ON c.id = paid.company_id
LEFT JOIN actuals ON actuals.payroll_run_id = paid.payroll_run_id
WHERE paid.expected_cost - COALESCE(actuals.actual_cost, 0) > 0.01
ORDER BY c.name_ar, paid.payroll_month, paid.run_number;
SQL

rows="$(psql --dbname="$DATABASE_URL" -At -F $'\t' -c "$PAYROLL_SQL")"
if [[ -n "$rows" ]]; then
  echo "ERROR: PAYROLL_LEDGER_RECONCILIATION_REQUIRED" >&2
  echo "company\trun\tmonth\texpected_cost\tledger_cost\tdifference" >&2
  echo "$rows" >&2
  exit 1
fi

echo "==> Payroll ledger reconciliation verified for all completed payroll runs"

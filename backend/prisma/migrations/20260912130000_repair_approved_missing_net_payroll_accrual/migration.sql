-- Approved, append-only repair for one provable missing net-payroll accrual.
-- It deliberately records a payable only.  It never pays cash, modifies a
-- salary invoice, changes a vault, or alters the already-posted advance settlement.

BEGIN;

DO $$
DECLARE
  v_target_count integer;
  v_run "payroll_runs"%ROWTYPE;
  v_expense_account "accounts"%ROWTYPE;
  v_payable_account "accounts"%ROWTYPE;
  v_advance_account "accounts"%ROWTYPE;
  v_period_count integer;
  v_open_period_count integer;
  v_item_count integer;
  v_positive_net_item_count integer;
  v_negative_net_item_count integer;
  v_expected_cost numeric;
  v_net_salary numeric;
  v_declared_advance numeric;
  v_equation_advance numeric;
  v_advance_deduction_count integer;
  v_advance_ledger_count integer;
  v_posted_advance numeric;
  v_existing_accrual_count integer;
  v_linked_salary_ledger_count integer;
  v_posted_accrual_count integer;
  v_posted_accrual_amount numeric;
  v_compliant_accrual_count integer;
  v_distinct_employee_count integer;
  v_audit_count integer;
  v_transaction_date timestamp(3);
BEGIN
  SELECT COUNT(*) INTO v_target_count
  FROM "payroll_runs" pr
  JOIN "companies" c ON c."id" = pr."company_id"
  WHERE c."name_ar" = 'وقت الكرك'
    AND c."is_archived" = false
    AND pr."run_number" = 'PR-2605-001'
    AND pr."payroll_month" >= TIMESTAMP '2026-04-01'
    AND pr."payroll_month" < TIMESTAMP '2026-05-01'
    AND pr."status" = 'completed';

  IF v_target_count <> 1 THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_TARGET_MISMATCH: expected one run, found %', v_target_count;
  END IF;

  SELECT pr.* INTO v_run
  FROM "payroll_runs" pr
  JOIN "companies" c ON c."id" = pr."company_id"
  WHERE c."name_ar" = 'وقت الكرك'
    AND c."is_archived" = false
    AND pr."run_number" = 'PR-2605-001'
    AND pr."payroll_month" >= TIMESTAMP '2026-04-01'
    AND pr."payroll_month" < TIMESTAMP '2026-05-01'
    AND pr."status" = 'completed'
  FOR UPDATE;

  PERFORM set_config('app.current_tenant_id', v_run."tenant_id", true);
  PERFORM pg_advisory_xact_lock(hashtext('payroll-accrual:' || v_run."company_id" || ':' || v_run."id"));

  IF v_run."payroll_accrued_at" IS NOT NULL THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_ALREADY_MARKED';
  END IF;

  SELECT * INTO v_expense_account
  FROM "accounts"
  WHERE "company_id" = v_run."company_id" AND "code" = 'EXP-004'
    AND "type" = 'expense' AND "is_active" = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_EXPENSE_ACCOUNT_INVALID';
  END IF;

  SELECT * INTO v_payable_account
  FROM "accounts"
  WHERE "company_id" = v_run."company_id" AND "code" = 'PAY-001'
    AND "type" = 'liability' AND "is_active" = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_PAYABLE_ACCOUNT_INVALID';
  END IF;

  SELECT * INTO v_advance_account
  FROM "accounts"
  WHERE "company_id" = v_run."company_id" AND "code" = 'ADV-001'
    AND "type" = 'asset' AND "is_active" = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_ADVANCE_ACCOUNT_INVALID';
  END IF;

  v_transaction_date := date_trunc('month', v_run."payroll_month") + INTERVAL '1 month - 1 day';

  SELECT COUNT(*), COUNT(*) FILTER (WHERE fp."status" = 'open')
    INTO v_period_count, v_open_period_count
  FROM "fiscal_periods" fp
  WHERE fp."company_id" = v_run."company_id"
    AND v_transaction_date::date BETWEEN fp."start_date"::date AND fp."end_date"::date;
  IF v_period_count > 0 AND v_period_count <> v_open_period_count THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_FISCAL_PERIOD_NOT_OPEN';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE pri."net_salary" > 0),
    COUNT(*) FILTER (WHERE pri."net_salary" < 0),
    COALESCE(SUM(pri."gross_salary" + pri."allowances_add" - pri."deductions"), 0),
    COALESCE(SUM(pri."net_salary"), 0),
    COALESCE(SUM(pri."advances_deduct"), 0),
    COALESCE(SUM(pri."gross_salary" + pri."allowances_add" - pri."deductions" - pri."net_salary"), 0)
  INTO v_item_count, v_positive_net_item_count, v_negative_net_item_count, v_expected_cost, v_net_salary, v_declared_advance, v_equation_advance
  FROM "payroll_run_items" pri
  WHERE pri."payroll_run_id" = v_run."id";

  IF v_item_count <> 8
     OR v_positive_net_item_count < 1
     OR v_negative_net_item_count <> 0
     OR ABS(v_run."total_amount" - v_net_salary) > 0.01
     OR ABS(v_expected_cost - 19266.6700) > 0.01
     OR ABS(v_net_salary - 10216.6700) > 0.01
     OR ABS(v_declared_advance - 9050.0000) > 0.01
     OR ABS(v_equation_advance - 9050.0000) > 0.01
     OR ABS(v_expected_cost - v_net_salary - v_declared_advance) > 0.01
     OR ABS(v_declared_advance - v_equation_advance) > 0.01 THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_PAYROLL_EQUATION_MISMATCH';
  END IF;

  SELECT COUNT(*) INTO v_existing_accrual_count
  FROM "ledger_entries" le
  WHERE le."tenant_id" = v_run."tenant_id"
    AND le."company_id" = v_run."company_id"
    AND le."reference_type" = 'payroll_accrual'
    AND le."reference_id" = v_run."id"
    AND le."status" = 'active';
  IF v_existing_accrual_count <> 0 THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_ALREADY_POSTED';
  END IF;

  SELECT COUNT(*) INTO v_linked_salary_ledger_count
  FROM "ledger_entries" le
  JOIN "invoices" i ON i."id" = le."reference_id" AND i."company_id" = v_run."company_id"
  WHERE le."company_id" = v_run."company_id" AND le."status" = 'active'
    AND le."reference_type" IN ('salary', 'invoice')
    AND i."kind" = 'salary' AND i."status" = 'active'
    AND (i."batch_id" = v_run."id" OR i."invoice_number" = 'SAL-' || v_run."run_number"
      OR STRPOS(COALESCE(i."notes", ''), v_run."run_number") > 0);
  IF v_linked_salary_ledger_count <> 0 THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_SALARY_ALREADY_LEDGERED';
  END IF;

  SELECT COUNT(DISTINCT d."id"), COUNT(le."id"), COALESCE(SUM(le."amount"), 0)
    INTO v_advance_deduction_count, v_advance_ledger_count, v_posted_advance
  FROM "employee_deductions" d
  JOIN "ledger_entries" le ON le."company_id" = v_run."company_id"
    AND le."reference_type" = 'advance_settlement' AND le."reference_id" = d."id"
    AND le."status" = 'active' AND le."vault_id" IS NULL
    AND le."debit_account_id" = v_expense_account."id"
    AND le."credit_account_id" = v_advance_account."id"
  WHERE d."company_id" = v_run."company_id" AND d."deduction_type" = 'advance'
    AND STRPOS(COALESCE(d."notes", ''), v_run."run_number") > 0;
  IF v_advance_deduction_count <> 4 OR v_advance_ledger_count <> 4
     OR ABS(v_posted_advance - 9050.0000) > 0.01
     OR ABS(v_posted_advance - v_declared_advance) > 0.01 THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_ADVANCE_EVIDENCE_MISMATCH';
  END IF;

  INSERT INTO "ledger_entries" (
    "id", "tenant_id", "company_id", "debit_account_id", "credit_account_id", "amount",
    "transaction_date", "entry_date", "reference_type", "reference_id", "reporting_class",
    "vault_id", "employee_id", "created_by_id", "status", "created_at"
  )
  SELECT
    md5('payroll-accrual-repair-v1:' || pri."id"),
    v_run."tenant_id", v_run."company_id", v_expense_account."id", v_payable_account."id", pri."net_salary",
    v_transaction_date, NOW(), 'payroll_accrual', v_run."id", 'operating_payroll',
    NULL, pri."employee_id", NULL, 'active', NOW()
  FROM "payroll_run_items" pri
  WHERE pri."payroll_run_id" = v_run."id" AND pri."net_salary" > 0
  ON CONFLICT ("id") DO NOTHING;

  SELECT
    COUNT(*), COALESCE(SUM(le."amount"), 0), COUNT(DISTINCT le."employee_id"),
    COUNT(*) FILTER (
      WHERE le."debit_account_id" = v_expense_account."id"
        AND le."credit_account_id" = v_payable_account."id"
        AND le."transaction_date"::date = v_transaction_date::date
        AND le."reporting_class" = 'operating_payroll'
        AND le."vault_id" IS NULL
        AND EXISTS (
          SELECT 1 FROM "payroll_run_items" pri
          WHERE pri."payroll_run_id" = v_run."id" AND pri."employee_id" = le."employee_id"
            AND pri."net_salary" > 0 AND pri."net_salary" = le."amount"
        )
    )
  INTO v_posted_accrual_count, v_posted_accrual_amount, v_distinct_employee_count, v_compliant_accrual_count
  FROM "ledger_entries" le
  WHERE le."tenant_id" = v_run."tenant_id" AND le."company_id" = v_run."company_id"
    AND le."reference_type" = 'payroll_accrual' AND le."reference_id" = v_run."id"
    AND le."status" = 'active';

  IF v_posted_accrual_count <> v_positive_net_item_count
     OR v_distinct_employee_count <> v_positive_net_item_count
     OR v_compliant_accrual_count <> v_positive_net_item_count
     OR ABS(v_posted_accrual_amount - v_net_salary) > 0.01 THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_POSTCONDITION_FAILED';
  END IF;

  INSERT INTO "audit_logs" (
    "id", "tenant_id", "company_id", "user_id", "action", "entity", "entity_id",
    "old_value", "new_value", "ip", "user_agent", "created_at"
  ) VALUES (
    md5('audit:payroll-accrual-repair-v1:' || v_run."id"),
    v_run."tenant_id", v_run."company_id", NULL, 'reconcile', 'payroll_accrual', v_run."id", NULL,
    jsonb_build_object(
      'runNumber', v_run."run_number", 'payrollMonth', to_char(v_run."payroll_month", 'YYYY-MM'),
      'source', 'approved-user-correction', 'netPayable', v_net_salary,
      'advancesAlreadySettled', v_posted_advance, 'entryCount', v_positive_net_item_count,
      'transactionDate', v_transaction_date::date, 'noCash', true
    ),
    NULL, 'prisma-migration', NOW()
  ) ON CONFLICT ("id") DO NOTHING;

  SELECT COUNT(*) INTO v_audit_count
  FROM "audit_logs"
  WHERE "id" = md5('audit:payroll-accrual-repair-v1:' || v_run."id")
    AND "tenant_id" = v_run."tenant_id" AND "company_id" = v_run."company_id"
    AND "entity" = 'payroll_accrual' AND "entity_id" = v_run."id";
  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_AUDIT_FAILED';
  END IF;

  UPDATE "payroll_runs"
  SET "payroll_accrued_at" = COALESCE("payroll_accrued_at", NOW())
  WHERE "id" = v_run."id" AND "tenant_id" = v_run."tenant_id";

  IF NOT EXISTS (
    SELECT 1 FROM "payroll_runs"
    WHERE "id" = v_run."id" AND "tenant_id" = v_run."tenant_id"
      AND "payroll_accrued_at" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'APPROVED_MISSING_NET_PAYROLL_ACCRUAL_MARKER_FAILED';
  END IF;
END $$;

COMMIT;

ALTER TABLE "payroll_run_items"
ADD COLUMN "advance_selections" JSONB;

COMMENT ON COLUMN "payroll_run_items"."advance_selections" IS
'Explicit payroll advance selections as [{advanceId, amount}]; [] defers all advances for the run month.';

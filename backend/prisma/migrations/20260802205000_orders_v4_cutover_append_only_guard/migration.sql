-- Keep V4 audit ledgers append-only in normal operation while permitting the
-- explicitly authorized, transaction-local legacy cutover to replace test data.
CREATE OR REPLACE FUNCTION orders_v4_reject_mutation() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.orders_v4_cutover_mode', true) = 'authorized' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Orders V4 audit rows are append-only';
END;
$$ LANGUAGE plpgsql;

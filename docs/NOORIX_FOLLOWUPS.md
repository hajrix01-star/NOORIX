# Noorix Follow-ups

Last reviewed: 2026-06-27

## Server / Operations

- GitHub Actions database backup is failing because required secrets appear unset: `VPS_DB_PASSWORD` and `GDRIVE_SCRIPT_URL`.
- Internal full system backup fails during `pg_dump` because PostgreSQL RLS affects `staff_order_items`.
- Server disk usage is high: about 41G used of 48G, around 86%.
- Redis is listening on `0.0.0.0:6379`; review whether it should be bound to localhost or protected.
- Production frontend is built from commit `636567e7`, while `/var/www/noorix` Git HEAD is `23ed0306` with copied deployment/backend changes. This appears consistent with the deploy workflow, but should be documented or normalized.
- PM2 reports an available update, though `noorix-backend` is currently online and stable.

## Dependencies / Security

- Local `npm ci` reported 16 dependency vulnerabilities: 1 low, 8 moderate, 6 high, and 1 critical. Review with `npm audit` in a separate task before changing dependency versions.

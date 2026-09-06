# Build Governance — Payroll Accrual Advisory-Lock Regression Fix

## Build contract

- **Objective:** Restore payroll-run approval by executing the PostgreSQL transaction advisory lock through Prisma's command API, which does not attempt to deserialize PostgreSQL's `void` result.
- **Users and critical journey:** An authorized payroll approver submits an existing payroll run. The backend obtains a transaction-scoped lock, detects an existing active accrual for idempotency, validates the fiscal period, settles already-selected advances, and posts the accrual ledger entry.
- **In scope:** `backend/src/hr/hr-payroll-accrual.util.ts` and its focused unit regression test.
- **Out of scope:** Payroll/advance data, schemas, migrations, accounting policies, deployment, PM2, Hostinger, and frontend behavior.
- **Acceptance criteria:** (1) the advisory-lock SQL uses `$executeRaw`; (2) a unit test proves `$executeRaw` is called and `$queryRaw` is not required; (3) focused test and backend build pass; (4) an independent delivery review is requested before any deployment decision.
- **Assumptions:** The provided production diagnosis is correct; `pg_advisory_xact_lock` is intentionally transaction-scoped; the existing surrounding interactive transaction provides atomicity.

## ERP cycle and controls (G0)

| Stage | Control relevant to this fix |
| --- | --- |
| Approval / posting | Backend transaction owns the advisory lock; concurrent approval attempts serialize by company and run. |
| Idempotency | An existing active `payroll_accrual` ledger entry returns a replay result without creating a duplicate. |
| Period / advances / ledger | Existing backend validation and posting remain unchanged; no financial policy or data is altered. |
| Auditability | The lock protects the existing approved posting path; the change produces no direct data operation by itself. |

## Capacity and continuity profile (G1)

- **Critical operation:** concurrent payroll approval for the same `(companyId, runId)`.
- **Concurrency rule:** PostgreSQL `pg_advisory_xact_lock(hashtext('payroll-accrual:<company>:<run>'))` serializes one run's transaction; different runs can proceed independently.
- **Data and growth:** no new reads, writes, indexes, tables, retention, queues, or background work are introduced.
- **Targets and limits:** preserve current transaction behavior. A local unit regression test verifies API selection; no production/shared-environment load test is authorized or required for this one-line command-API correction.
- **Observability and recovery:** existing backend/PM2 error logging remains the diagnostic source. Rollback is a one-line reversal, though it would reintroduce the known Prisma P2010 failure.

## Architecture and contract review (G2)

- **Ownership:** the payroll accrual utility owns locking before it reads/creates the accrual. PostgreSQL owns lock lifecycle and releases it when the transaction ends.
- **Contract:** `$executeRaw(Prisma.sql\`SELECT pg_advisory_xact_lock(hashtext(...))\`)` executes a command with no result deserialization. `$queryRaw` is reserved for queries that return a Prisma-deserializable result.
- **Financial invariants:** no amount calculation, account lookup, advance settlement, or ledger write is changed. Existing idempotency and fiscal-period checks stay in place.
- **Direct-path decision:** replace only the incorrect Prisma primitive; do not add a wrapper, dependency, retry layer, schema change, or migration.

## Technology and verification (G3)

- **Stack:** existing NestJS/Prisma/PostgreSQL/Jest setup.
- **Dependencies:** none added or updated.
- **Verification commands:** focused Jest spec and `npm run build` from `backend`.

## Gate register

| Gate | Status | Owner | Independent reviewer | Evidence / decision |
| --- | --- | --- | --- | --- |
| G0 Governance and contract | Approved | Build lead / ERP specialist | Gatekeeper | Contract and ERP control map above; code scope has not begun before this record. |
| G1 Capacity profile | Approved | Capacity engineer | Architect | Transaction lock preserves existing concurrency control; no capacity claims beyond the focused scope. |
| G2 Architecture and contracts | Approved | Architect / service builder | ERP specialist | Command API correction preserves financial and idempotency invariants. |
| G3 Technology and libraries | Approved | Library steward | Architect | Existing Prisma API; no dependency change. |
| G4 Experience system | Not applicable | — | — | No UI change. |
| G5 Vertical slice | Closed | Service builder | Quality / ERP specialists | `$executeRaw` regression test passed; backend build passed. |
| G6 Capacity evidence | Not applicable | — | — | No new load characteristic; production/shared load testing excluded. |
| G7 Controlled build | Closed | Build lead | Gatekeeper | Scoped diff, focused test, and backend build reviewed. |
| G8 Delivery candidate | Approved for push | Operations engineer | Alpha Delivery Team | Independent review found no P0–P2 issue; production approval remains conditional on the GitHub deployment workflow matching this commit. |

## Live operations ledger

| ID | Gate | Type | Intent / action | Result and evidence | Impact / rollback | Executor / reviewer |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | G0–G3 | Read | Read alpha-build governance, ERP, capacity, and architecture guidance. | Guidance applied in this contract. | No project change. | Build lead / pending gatekeeper. |
| 002 | G0–G3 | Read | Inspect root/backend package scripts, payroll-accrual utility and its spec, docs index, and Git status. | Confirmed `$queryRaw` lock call, existing Jest spec, `backend` test/build scripts, and no pre-existing working-tree changes. | Read-only. | Build lead / pending gatekeeper. |
| 003 | G0–G3 | Decision | Select direct Prisma command-API replacement with a focused regression test; add no dependency or schema change. | Decision recorded above. | One-line code reversal would restore prior behavior (not recommended). | Architect / ERP specialist. |
| 004 | G5 | Execute | Replace the lock's `$queryRaw` call with `$executeRaw`; update normal-posting and idempotent-replay unit fixtures/assertions. | Only the scoped utility and spec changed; `$executeRaw` is asserted once on both paths. | No data/schema/policy change; reversible by restoring the prior lines (which restores the known failure). | Service builder / quality reviewer pending. |
| 005 | G5 | Test failure | Run `npm test -- hr-payroll-accrual.util.spec.ts` from `backend`. | Blocked before Jest: package workspaces have no `node_modules`; `packages/finance-core` cannot find `tsc`. | No application/data impact. | Quality guardian / pending reviewer. |
| 006 | G5 | Environment check | Confirm local dependency directories and diff hygiene; attempt lockfile installation for `packages/finance-core`. | All three dependency directories absent; `git diff --check` clean. `npm ci` cannot run because `packages/finance-core` has no lockfile. | No source or data change. | Operations engineer / pending reviewer. |
| 007 | G5 | Environment preparation | Install local dependency directories only; generate Prisma Client from the existing schema. | `packages/finance-core` and `packages/permissions-core` installed without lockfile changes; backend installed from its lockfile; Prisma Client generated locally. | Only ignored dependency/build output changed; no database migration, seed, or data operation. | Operations engineer / quality guardian. |
| 008 | G5 | Test | Re-run `npm test -- hr-payroll-accrual.util.spec.ts` from `backend`. | PASS: 1 suite, 3 tests. The first re-run was blocked only because Prisma Client had not yet been generated; after generation it passed. | No data operation. | Quality guardian / pending independent delivery review. |
| 009 | G5/G7 | Test | Run `npm run build` from `backend`. | PASS: internal finance/permissions builds, Prisma Client generation, and Nest build completed. | Build output is local and ignored; no deployment. | Quality guardian / pending independent delivery review. |
| 010 | G8 | Read | Capture candidate provenance and inspect lock API use after verification. | Base HEAD `94536fd3bf7e82135b065aaa20c9dd1e1d496464`; working-tree candidate is uncommitted; no lock `$queryRaw` call remains in the scoped utility; local built utility SHA-256 `553A21CFBF3226BDE2884B294DFCF2CCB780A3DC2A900416566AF1C3D6E7E3F7`. | No deployment candidate can be matched to production until committed/built in the deployment environment. | Candidate guardian / Alpha Delivery review in progress. |
| 011 | G8 | Independent review | Alpha Delivery quality reviewer inspected the scoped code, tests, diff, and verification evidence. | No P0–P2 finding. Optional P3: explicitly assert `$queryRaw` is not called, though the test's mock already makes regression to it fail. Reviewer approved the scoped candidate for push, conditional on production workflow provenance/health verification. | No deployment executed yet; no data change. | Alpha Delivery quality reviewer / delivery lead. |

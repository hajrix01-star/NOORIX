# NOORIX HR and Finance Core Unification Plan

## Objective

NOORIX must keep one authoritative source for official numbers. The database and backend remain the authority for persisted business data, while shared calculation code must live in one reusable package. The frontend may display, preview, and collect input, but it must not become an independent source of accounting or HR truth.

## Scope

This plan covers the remaining code-level centralization after the server authority fixes:

- Finance math and VAT calculation.
- HR salary package, overtime, and salary calculator formulas.
- End-of-service calculation.
- Batch invoice row calculation reused by purchases and expenses.
- Invoice DTO update policy, especially immutable accounting fields.

It intentionally does not include dependency security upgrades from `npm audit`. Those require a separate upgrade track because several fixes need major package changes.

## Architecture Decision

Create `packages/finance-core` as the single shared calculation package.

Rules:

- No React imports.
- No NestJS imports.
- No Prisma imports.
- No database calls.
- Pure deterministic calculation only.
- Use `decimal.js` for money/legal calculations.
- Frontend wrappers may convert results to `number` for display only.

## Accounting Update Policy

Generic invoice update must not silently inherit every create field.

Rules:

- `kind` may be corrected through the owner-only invoice update route.
- `companyId`, `kind`, `idempotencyKey`, and `batchId` must not be inherited from create DTO into generic update DTO.
- Invoice kind correction is not available to normal roles; the existing update route is owner-only and records the normal invoice audit snapshot.
- DTO update classes should use `PartialType` with `OmitType` or `PickType` where safe, but only after reviewing immutable accounting fields one by one.

## Implementation Checklist

- [x] Add `packages/finance-core` package.
- [x] Wire frontend and backend builds so `finance-core` builds first.
- [x] Move finance math into `finance-core`.
- [x] Replace frontend finance math imports with `@noorix/finance-core`.
- [x] Replace backend finance math imports with `@noorix/finance-core`.
- [x] Keep only compatibility re-export files temporarily where needed.
- [x] Move HR salary package and overtime formula into `finance-core`.
- [x] Replace backend salary package imports with `@noorix/finance-core`.
- [x] Replace frontend HR salary imports with `@noorix/finance-core` where the logic is official calculation.
- [x] Move EOS formula into `finance-core`.
- [x] Add backend EOS calculation service/endpoint before any official persisted settlement depends on EOS.
- [x] Keep frontend EOS as preview only and align it with `finance-core`.
- [ ] Extract shared batch invoice row calculation/hook for purchases and expenses.
- [x] Refactor `UpdateInvoiceDto` using safe `PartialType(OmitType(...))` or a stricter explicit DTO.
- [x] Add tests for finance math, HR salary, EOS, and invoice update immutability.
- [x] Run frontend tests, backend tests, typecheck, and builds.
- [x] Run final code audit for duplicate official calculations and framework-free `finance-core`.

## Acceptance Criteria

- No official finance/HR formula exists independently in both `src/` and `backend/src/`.
- `packages/finance-core` has no framework imports.
- Backend still recomputes official persisted amounts.
- EOS has backend calculation support before being treated as official persisted output.
- Invoice kind correction is limited to the owner-only update route.
- Existing user behavior remains stable except where a safer accounting rule intentionally blocks unsafe edits.
- All relevant tests and builds pass.

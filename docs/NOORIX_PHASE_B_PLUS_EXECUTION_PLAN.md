# NOORIX Phase B+ Execution Plan

## Objective

Reduce structural code weight, remove unneeded OCR invoice functionality, and improve shared UI foundations without touching official finance/HR calculation authority from Phase A.

## Execution Rules

- OCR Prisma models and database tables are removed in this phase after owner confirmation that OCR data is experimental and does not need retention.
- The server and database remain the source of truth. Browser storage may only be used as transient UI cache.
- Refactoring must preserve behavior outside the explicitly removed OCR feature.
- Large-file cleanup must fail new regressions while excluding translation dictionaries and generated/test files.
- Type safety is improved where files are touched; broad `any` cleanup remains a separate track.

## Checklist

### B+1 Remove OCR Application Code

- [x] Remove OCR routes from the frontend router.
- [x] Remove OCR navigation entries from the sidebar.
- [x] Remove OCR frontend permissions and route permission entries.
- [x] Remove OCR backend permissions and permission modules.
- [x] Remove OCR reminder coupling from SmartChat.
- [x] Remove OCR query-key and invalidation coupling.
- [x] Remove OCR translations from the translation bundle.
- [x] Remove backend `OcrInvoicesModule` from `AppModule`.
- [x] Delete `src/modules/OcrInvoices`.
- [x] Delete `backend/src/ocr-invoices`.
- [x] Remove Prisma OCR models and relations.
- [x] Add a dedicated migration to drop experimental OCR database tables.

### B+2 Code Governance And Safe Cleanup

- [x] Make `scripts/audit-large-files.mjs` fail on real oversized code files.
- [x] Exclude translation dictionaries, generated files, tests, declarations, and retired monolith files from large-file failure.
- [x] Add `audit:large-files` to pre-commit.
- [x] Delete confirmed dead monolith `backend/src/financial-core/financial-core.service.monolith.ts`.
- [x] Delete empty future placeholder `hrQuickEntryValidators.ts`.
- [x] Convert remaining HR JS/JSX files to TypeScript where low-risk.
- [x] Review `PartialType` candidates; kept Zod DTOs and required-command DTOs unchanged intentionally.

### B+3 SmartTable Foundation

- [x] Add `aria-sort` to sortable headers.
- [x] Use fixed layout with consistent cell ellipsis.
- [x] Move column resize to pointer events for mouse and touch.
- [x] Keep database-backed table preferences as a follow-up if it requires schema/API work beyond this safe batch.

### Final Audit

- [x] Run typecheck.
- [x] Run frontend tests.
- [x] Run backend tests.
- [x] Run frontend build.
- [x] Run backend build.
- [x] Run `git diff --check`.
- [x] Review remaining OCR references; only the drop migration may mention retired OCR table names.




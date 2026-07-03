# Frontend Remaining UI Governance Closure

Date: 2026-07-03

Status: closed for safe cleanup; future work must be RFC-led or domain-scoped.

## Production Closeout

| Item | Result |
|---|---|
| Closing PR | `#239` |
| Main commit | `3f53069b076b04d1a5dcba6a901f5f269a02e358` |
| Main CI | passed |
| Deploy workflow | passed |
| Live build meta | `3f53069b076b04d1a5dcba6a901f5f269a02e358` |
| API readiness | `status: ok`, `dbConnected: true` |
| API liveness | `status: live` |

## Final Counts

| Area | Count | Source |
|---|---:|---|
| Governed manual `<table>` outside `src/ui` | 53 | `scripts/table-manual-exceptions.json` |
| Files with governed manual tables | 33 | `scripts/table-manual-exceptions.json` |
| Raw `<table` outside `src/ui` by direct scan | 57 | includes central print builder/tests |
| `SmartTable` JSX usages | 46 | `rg "<SmartTable\\b" src --glob "*.tsx"` |
| Files using `SmartTable` JSX | 36 | direct scan |
| `SimpleTable` JSX usages | 23 | direct scan |
| Files using `SimpleTable` JSX | 16 | direct scan |
| `MatrixTable` production usages outside `src/ui` | 1 | direct scan |
| React `style={{` total | 10 | `scripts/inline-style-governance-baseline.json` |
| React `style={{` inside `src/ui` | 0 | `scripts/inline-style-governance-baseline.json` |
| React `style={{` outside `src/ui` | 10 | `scripts/inline-style-governance-baseline.json` |
| Raw `<button` outside `src/ui` | 1 | direct scan |
| Raw input/select/textarea outside `src/ui` | 0 | direct scan |
| `src/index.css` lines | 6160 | `npm.cmd run check:css-governance` |
| `src/ui/ui.css` lines | 1705 | `npm.cmd run check:css-governance` |

## Closed Items

| Item | Closure |
|---|---|
| Controls cleanup | raw inputs/selects/textarea outside UI reduced to 0 |
| Button cleanup | raw button outside UI reduced to 1 documented/special case |
| Inline styles | outside-UI baseline reduced to 10; UI-core direct inline styles reduced to 0 |
| Table governance | every governed manual table has a file count and reason |
| Print tables | safe catalog/calendar/report builders centralized through `printTableHtml` |
| Matrix tables | `MatrixTable` exists with first safe owner conversion |
| SmartTable engine | TanStack introduced internally behind current `SmartTable` API |
| CI guardrails | table, control, CSS, inline-style, build, financial tests, and full tests pass |

## Remaining Manual Table Families

| Category | Files | Tables | Decision |
|---|---:|---:|---|
| `print-financial` | 7 | 15 | leave until financial PrintTable RFC |
| `document-print` | 4 | 11 | leave fixed document layout |
| `editable-grid` | 6 | 6 | require EditableTable RFC |
| `payroll-protected` | 4 | 6 | protected; no UI cleanup conversion |
| `financial-report` | 3 | 4 | require Matrix/financial-report RFC |
| `tax-protected` | 2 | 3 | protected; no conversion without tax tests |
| `tax-print` | 1 | 2 | require Tax PrintTable RFC |
| `matrix-table` | 1 | 1 | P&L matrix; require visual baseline |
| `bank-print` | 1 | 1 | require Bank PrintTable RFC |
| `bank-protected` | 1 | 1 | protected bank workflow |
| `hr-financial` | 1 | 1 | protected HR financial flow |
| `purchases-protected` | 1 | 1 | protected purchases workflow |
| `print-export-html` | 1 | 1 | Payroll only; leave protected |

## Remaining Inline Styles

| File | Count | Decision |
|---|---:|---|
| `src/modules/Reports/GeneralPlTable.tsx` | 2 | leave for financial matrix runtime tone |
| `src/modules/Purchases/batch/components/PurchasesBatchToolbar.tsx` | 1 | leave for print/table alignment |
| `src/modules/Reports/BankStatementMappingModal.tsx` | 1 | leave for bank preview layout |
| `src/modules/Reports/ReportsDetailModal.tsx` | 1 | leave for chart payload style |
| `src/modules/Reports/bank/BankCategoryCardRow.tsx` | 1 | leave for bank category color |
| `src/modules/Reports/bank/components/analysis/BankAnalysisCardShell.tsx` | 1 | leave for progress data style |
| `src/modules/Reports/bank/components/analysis/BankAnalysisCategoryBarCard.tsx` | 1 | leave for chart dimension |
| `src/modules/Reports/bank/components/analysis/BankAnalysisCategoryPieCard.tsx` | 1 | leave for chart series color |
| `src/modules/Reports/bank/components/analysis/BankAnalysisPieTooltip.tsx` | 1 | leave for chart tooltip color |

## Next Work Rule

| Rule | Required |
|---|---|
| No broad UI cleanup PRs | yes |
| One table family per PR | yes |
| Protected payroll/tax/bank/purchases require owner acceptance | yes |
| SmartTable v2 work remains compatibility-first | yes |
| Live deploy only after merge and green CI | yes |

## Verification

| Command | Result |
|---|---|
| `npm.cmd run check:table-governance` | passed |
| `npm.cmd run check:inline-style-governance` | passed |
| `npm.cmd run check:css-governance` | passed |
| `npm.cmd run check:control-governance` | passed |
| GitHub main CI after `#239` | passed |
| GitHub deploy after `#239` | passed |

# PrintTable Foundation

Date: 2026-07-03

Status: foundation implemented; broad table conversion is not started.

## Purpose

`PrintTable` is the governed path for print/export HTML tables that do not need live grid interaction.

The current foundation is:

| File | Role |
|---|---|
| `src/utils/printTableHtml.ts` | pure HTML builder for print tables |
| `src/utils/printTableHtml.test.ts` | escaping, class sanitation, empty state, footer coverage |
| `src/ui/PrintPreviewModal.tsx` | in-app print/PDF preview route for exported print tables |
| `src/utils/printUtils.ts` | shared print window CSS for print-table alignment and empty states |

## Allowed First Uses

| Case | Decision |
|---|---|
| Generic PDF/export tables routed through `PrintPreviewModal` + `buildPrintDocumentHtml` | allowed |
| Non-financial print preview with plain rows and columns | allowed after focused test |
| Simple document table without rowspan/colspan | allowed after visual smoke test |

## Temporary No-Touch Scope

| Scope | Reason |
|---|---|
| Tax/VAT print documents | protected compliance layout |
| Payroll/EOS/settlement print tables | protected HR financial workflow |
| Bank reconciliation/classification tables | protected financial workflow |
| Purchases batch documents | protected purchasing workflow |
| Financial report matrices and P&L layouts | wait for `MatrixTable`/financial print RFC |
| Tables with editable cells, row actions, rowspan/colspan, grouped rows, tree rows, or sticky columns | not covered by foundation |

## Acceptance Conditions

| Requirement | Status |
|---|---|
| Generated values are HTML-escaped | covered by unit test |
| Class names are sanitized before output | covered by unit test |
| Empty state has stable colspan | covered by unit test |
| P&L/export row classes remain supported | routed through row metadata |
| Existing manual table registry remains the source of truth | enforced by `check:table-governance` |

## Next Conversion Rule

Before converting any existing manual print table, classify it with:

| Question | Required Answer |
|---|---|
| Is it financial, tax, payroll, bank, purchases, or compliance-related? | if yes, leave protected |
| Does it print a fixed legal/document layout? | if yes, leave until document print RFC |
| Does it need rowspan/colspan, grouped rows, editable cells, or sticky columns? | if yes, leave until a richer component exists |
| Is it a plain export table with rows and columns only? | candidate for `PrintTable` |

## Completion Boundary

This phase closes the foundation only. It does not claim that all remaining manual tables are converted.

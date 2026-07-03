# Frontend Inline Style Governance

Date: 2026-07-03

Status: active guardrail.

## Baseline

| Metric | Count |
|---|---:|
| `style={{` total | 214 |
| files with `style={{` | 78 |
| inside `src/ui` | 31 |
| `src/ui` files | 11 |
| outside `src/ui` | 183 |
| outside `src/ui` files | 67 |

## Top Files

| File | Count |
|---|---:|
| `src/modules/Reports/BankStatementMappingModal.tsx` | 17 |
| `src/ui/SmartTable/SmartTable.tsx` | 13 |
| `src/modules/Reports/bank/BankStatementTransactionsFullTab.tsx` | 12 |
| `src/modules/Reports/GeneralPlTable.tsx` | 11 |
| `src/modules/Treasury/components/VaultFormModal.tsx` | 7 |
| `src/modules/HR/components/useAdvanceTableModel.tsx` | 7 |
| `src/modules/Owner/components/OwnerMonthlyComparisonTable.tsx` | 7 |
| `src/modules/Reports/bank/BankStatementTemplatesPanel.tsx` | 6 |
| `src/components/UserMenu.tsx` | 6 |
| `src/modules/Purchases/components/BatchRow.tsx` | 6 |

## Rule

Run:

```bash
npm.cmd run check:inline-style-governance
```

The check fails if inline style usage grows beyond this baseline. Reductions should lower the baseline in the same PR.

# Frontend Inline Style Governance

Date: 2026-07-03

Status: active guardrail.

## Baseline

| Metric | Count |
|---|---:|
| `style={{` total | 510 |
| files with `style={{` | 122 |
| inside `src/ui` | 31 |
| `src/ui` files | 11 |
| outside `src/ui` | 479 |
| outside `src/ui` files | 111 |

## Top Files

| File | Count |
|---|---:|
| `src/modules/HR/components/EmployeeDocModal/components/FinalSettlementPreview.tsx` | 41 |
| `src/modules/Purchases/components/BatchPrintSheet.tsx` | 28 |
| `src/modules/Sales/components/SalesEditModal.tsx` | 26 |
| `src/modules/Reports/BankStatementMappingModal.tsx` | 17 |
| `src/modules/Purchases/batch/components/PurchasesBatchToolbar.tsx` | 14 |
| `src/modules/HR/components/EmployeeDocModal/components/EmployeeDocSalaryBreakdownTable.tsx` | 14 |
| `src/ui/SmartTable/SmartTable.tsx` | 13 |
| `src/modules/HR/components/EmployeeDocModal/components/ContractDocPreview.tsx` | 13 |
| `src/modules/Reports/bank/BankStatementTransactionsFullTab.tsx` | 12 |
| `src/modules/HR/components/EmployeeDocModal/components/SalaryCertificatePreview.tsx` | 12 |

## Rule

Run:

```bash
npm.cmd run check:inline-style-governance
```

The check fails if inline style usage grows beyond this baseline. Reductions should lower the baseline in the same PR.

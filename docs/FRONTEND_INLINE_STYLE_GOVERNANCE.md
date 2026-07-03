# Frontend Inline Style Governance

Date: 2026-07-03

Status: active guardrail.

## Baseline

| Metric | Count |
|---|---:|
| `style={{` total | 135 |
| files with `style={{` | 65 |
| inside `src/ui` | 31 |
| `src/ui` files | 11 |
| outside `src/ui` | 104 |
| outside `src/ui` files | 54 |

## Top Files

| File | Count |
|---|---:|
| `src/ui/SmartTable/SmartTable.tsx` | 13 |
| `src/modules/Reports/GeneralPlTable.tsx` | 11 |
| `src/modules/Owner/components/OwnerMonthlyComparisonTable.tsx` | 7 |
| `src/modules/Purchases/components/BatchRow.tsx` | 6 |
| `src/modules/Owner/components/OwnerPerformanceChart.tsx` | 5 |
| `src/modules/Reports/TaxReportTab.tsx` | 5 |
| `src/ui/SimpleTable.tsx` | 5 |
| `src/modules/Dashboard/components/DashboardCalendarTab/components/DashboardCalendarDayCell.tsx` | 4 |
| `src/modules/HR/components/employeeProfile/EmployeeProfilePayrollSection.tsx` | 4 |
| `src/modules/HR/tabs/ResidencyTab.tsx` | 3 |
| `src/modules/Reports/bank/BankCategoryFormModal.tsx` | 3 |
| `src/modules/Reports/BankStatementMappingModal.tsx` | 3 |

## Rule

Run:

```bash
npm.cmd run check:inline-style-governance
```

The check fails if inline style usage grows beyond this baseline. Reductions should lower the baseline in the same PR.

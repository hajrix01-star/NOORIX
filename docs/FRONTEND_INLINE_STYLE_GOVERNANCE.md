# Frontend Inline Style Governance

Date: 2026-07-03

Status: active guardrail.

## Baseline

| Metric | Count |
|---|---:|
| `style={{` total | 98 |
| files with `style={{` | 46 |
| inside `src/ui` | 14 |
| `src/ui` files | 5 |
| outside `src/ui` | 84 |
| outside `src/ui` files | 41 |

## Top Files

| File | Count |
|---|---:|
| `src/modules/Reports/GeneralPlTable.tsx` | 11 |
| `src/modules/Owner/components/OwnerMonthlyComparisonTable.tsx` | 7 |
| `src/ui/SmartTable/SmartTable.tsx` | 7 |
| `src/modules/Purchases/components/BatchRow.tsx` | 6 |
| `src/modules/Owner/components/OwnerPerformanceChart.tsx` | 5 |
| `src/modules/Reports/TaxReportTab.tsx` | 5 |
| `src/modules/HR/components/employeeProfile/EmployeeProfilePayrollSection.tsx` | 4 |
| `src/ui/SimpleTable.tsx` | 4 |
| `src/modules/Reports/bank/BankCategoryFormModal.tsx` | 3 |
| `src/modules/Reports/BankStatementMappingModal.tsx` | 3 |
| `src/components/UserMenu.tsx` | 2 |
| `src/modules/Dashboard/components/DashboardCalendarTab/components/DashboardCalendarDayCell.tsx` | 2 |
| `src/modules/HR/components/HrQuickEntrySheet/HrQuickEntrySheet.tsx` | 2 |
| `src/modules/Reports/bank/BankStatementPieDrilldownModal.tsx` | 2 |
| `src/modules/Reports/bank/BankStatementReconciliationTab.tsx` | 2 |

## Rule

Run:

```bash
npm.cmd run check:inline-style-governance
```

The check fails if inline style usage grows beyond this baseline. Reductions should lower the baseline in the same PR.

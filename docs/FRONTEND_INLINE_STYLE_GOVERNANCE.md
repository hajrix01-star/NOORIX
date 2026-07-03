# Frontend Inline Style Governance

Date: 2026-07-03

Status: active guardrail.

## Baseline

| Metric | Count |
|---|---:|
| `style={{` total | 110 |
| files with `style={{` | 53 |
| inside `src/ui` | 14 |
| `src/ui` files | 5 |
| outside `src/ui` | 96 |
| outside `src/ui` files | 48 |

## Top Files

| File | Count |
|---|---:|
| `src/modules/Reports/GeneralPlTable.tsx` | 11 |
| `src/modules/Owner/components/OwnerMonthlyComparisonTable.tsx` | 7 |
| `src/ui/SmartTable/SmartTable.tsx` | 7 |
| `src/modules/Purchases/components/BatchRow.tsx` | 6 |
| `src/modules/Owner/components/OwnerPerformanceChart.tsx` | 5 |
| `src/modules/Reports/TaxReportTab.tsx` | 5 |
| `src/modules/Dashboard/components/DashboardCalendarTab/components/DashboardCalendarDayCell.tsx` | 4 |
| `src/modules/HR/components/employeeProfile/EmployeeProfilePayrollSection.tsx` | 4 |
| `src/ui/SimpleTable.tsx` | 4 |
| `src/modules/Reports/bank/BankCategoryFormModal.tsx` | 3 |
| `src/modules/Reports/BankStatementMappingModal.tsx` | 3 |
| `src/components/UserMenu.tsx` | 2 |
| `src/modules/Dashboard/overview/components/DashboardOverviewTopCharts.tsx` | 2 |
| `src/modules/HR/components/HrQuickEntrySheet/HrQuickEntrySheet.tsx` | 2 |
| `src/modules/Invoices/invoicesListTableModel.tsx` | 2 |

## Rule

Run:

```bash
npm.cmd run check:inline-style-governance
```

The check fails if inline style usage grows beyond this baseline. Reductions should lower the baseline in the same PR.

# Display Grid Governance

Date: 2026-07-09

Status: governed decision for non-table grids that visually act like calendars, key-value summaries, or protected editable disclosure rows.

## Decision

Use `SmartTable` for sortable, searchable, record-based data tables.

Use `SimpleTable` for static display tables that do not need sorting, searching, row selection, or table state.

Use `MatrixTable` for wide financial or dashboard matrices with sticky/grouped behavior.

Use a registered display grid only when the layout is not semantically a table, or when conversion would cross a protected editable/financial/tax boundary.

## Current Counts

| Metric | Count |
|---|---:|
| Governed display-grid files | 6 |

## Governed Files

| File | Category | Decision |
|---|---|---|
| `src/modules/Dashboard/components/DashboardCalendarTab/components/DashboardCalendarGrid.tsx` | `calendar-grid` | `leave-central-component` |
| `src/modules/HajriTax/HajriTaxDetailEditor.tsx` | `editable-tax-grid` | `leave-protected` |
| `src/modules/HajriTax/HajriTaxDisclosureRows.tsx` | `editable-tax-grid` | `leave-protected` |
| `src/modules/Assets/components/AssetsWarrantyQueueTable.tsx` | `warranty-queue-grid` | `leave-central-component` |
| `src/modules/Settings/components/backup/BackupCountsGrid.tsx` | `key-value-grid` | `leave-central-component` |
| `src/modules/Dashboard/overview/components/DashboardOverviewRevenueDailyAvgPanel.tsx` | `key-value-grid` | `leave-central-component` |

## Governance

| File | Role |
|---|---|
| `scripts/display-grid-reasons.json` | exact registry and reason for every governed display-grid file |
| `scripts/check-display-grid-governance.mjs` | blocks known table-like Grid patterns unless they are registered |
| `docs/DISPLAY_GRID_GOVERNANCE.md` | source-of-truth decision for non-table Grid exceptions |

Acceptance command: `npm.cmd run check:display-grid-governance`.

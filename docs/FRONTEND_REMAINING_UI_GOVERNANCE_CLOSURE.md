# Frontend Remaining UI Governance Closure

Date: 2026-07-03

Status: closed for safe cleanup; future changes require RFC or targeted implementation.

## Final Counts

| Area | Count | Decision |
|---|---:|---|
| React `style={{` total | 44 | governed |
| Inside `src/ui` | 14 | leave until UI-core refactor |
| Outside `src/ui` | 30 | documented runtime exceptions |
| Files with inline styles | 30 | every file has a reason |
| `src/index.css` lines | 6894 | baseline lowered after safe compaction |
| Manual `<table>` outside `src/ui` | 70 | governed and classified |
| Files with manual tables outside `src/ui` | 47 | every file has a reason |

## Remaining Inline Categories

| Category | Examples | Decision |
|---|---|---|
| Popover positioning | `KebabMenu`, `UserMenu`, searchable pickers | leave |
| UI-core table sizing | `SmartTable`, `SimpleTable` | leave until RFC |
| Chart/data colors | dashboard, owner, bank analysis | leave |
| Financial matrix runtime tone | `GeneralPlTable` | leave |
| Brand/user colors | branding and special-day colors | leave |

## Closed Items

| Item | Closure |
|---|---|
| Raw inline-style cleanup | safe usages reduced and governed |
| Remaining inline-style audit | `scripts/inline-style-manual-reasons.json` |
| CSS footprint | latest helper classes compacted |
| CI protection | inline, CSS, table, and control governance |
| Table exception classification | `docs/FRONTEND_TABLE_GOVERNANCE_STATUS.md` |

## Not In Scope For Safe Cleanup

| Item | Reason |
|---|---|
| Replacing `SmartTable` runtime styles | public API and tests rely on dynamic sizing/padding |
| Removing chart color inline styles | values come from runtime payloads |
| Rewriting popover positioning | requires floating-positioning abstraction and visual testing |
| Converting financial matrix backgrounds | protected financial report readability |

## Acceptance

| Check | Required Result |
|---|---|
| `npm.cmd run check:inline-style-governance` | passed |
| `npm.cmd run check:css-governance` | passed |
| `npm.cmd run check:control-governance` | passed |
| `npm.cmd run check:table-governance` | passed |
| CI build/tests | passed before deploy |


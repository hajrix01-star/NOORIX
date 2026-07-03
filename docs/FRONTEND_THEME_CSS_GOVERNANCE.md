# Frontend Theme CSS Governance

Date: 2026-07-03

Status: active guardrail.

## Baseline

| File | Lines | @media | !important | @keyframes | CSS vars | var refs | color-mix |
|---|---:|---:|---:|---:|---:|---:|---:|
| `src/index.css` | 7211 | 51 | 214 | 12 | 237 | 975 | 174 |
| `src/ui/ui.css` | 2378 | 6 | 22 | 8 | 12 | 298 | 1 |
| `src/modules/SmartChat/SmartChatScreen.css` | 945 | 5 | 8 | 3 | 0 | 79 | 11 |

Note: the 2026-07-03 batch moved static SmartTable loading styles and ThemePreview card variants from TSX inline style objects into governed CSS. This raises CSS line/var-reference limits while lowering the inline-style baseline.

Note: the later 2026-07-03 local batch moved safe Treasury vault icon tones and Sales channel tones from JSX inline style objects into governed CSS classes. This raises the CSS baseline while lowering raw inline styles.

Note: the latest 2026-07-03 local batch moved safe HR payroll tones, bank/report display tones, owner metric controls, P&L text/indent styles, and purchase batch date-error styling from JSX inline style objects into governed CSS classes. This raises the `src/index.css` line/var/color-mix/reports-selector baseline while reducing inline styles from 88 to 44.

## Rule

Run:

```bash
npm.cmd run check:css-governance
```

The check fails if central CSS grows beyond the baseline without an explicit baseline update.

CI runs the same check in `.github/workflows/ci.yml`.

## Cleanup Order

| Priority | Scope | Decision |
|---:|---|---|
| 1 | duplicated table layers in `index.css` | reduce carefully after visual checks |
| 2 | screen-specific CSS in `index.css` | move to screen CSS only when isolated |
| 3 | `!important` clusters | remove only with matching component coverage |
| 4 | tokens and variables | keep stable until component consumers are mapped |
| 5 | print CSS | leave until PrintTable phase |

## Screen-Specific Baseline

| File | Group | Matches |
|---|---|---:|
| `src/index.css` | table | 288 |
| `src/index.css` | reports | 238 |
| `src/index.css` | invoices | 116 |
| `src/index.css` | dashboard | 125 |
| `src/index.css` | modal | 116 |
| `src/index.css` | hr | 184 |
| `src/index.css` | shell | 73 |
| `src/index.css` | orders | 28 |
| `src/index.css` | print | 29 |
| `src/ui/ui.css` | table | 93 |
| `src/ui/ui.css` | modal | 84 |
| `src/ui/ui.css` | dashboard | 24 |

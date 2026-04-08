# Card surface system — audit checklist

Use this list when adding or reviewing screens so surfaces stay aligned with **dashboard KPI tokens** (`--noorix-card-radius`, `--noorix-card-shadow`, `noorix-surface-card`, `SmartTable` / `noorix-table-frame`).

## Before merge — quick checks

| # | Check | Pass criteria |
|---|--------|----------------|
| 1 | **Surface wrapper** | Prefer `import { Card } from '../../ui'` → `<Card>` / `SurfaceCard`, or class `noorix-surface-card` on the outer shell. |
| 2 | **No duplicate chrome** | On the same node as `noorix-surface-card`, do **not** add `border border-noorix-border`, `rounded-xl`, `shadow-sm`, or `style={{ boxShadow: … }}` unless documented (dashed empty states, marketing shells). |
| 3 | **Tables** | Data tables use `SmartTable` (already applies `noorix-table-frame`). |
| 4 | **Hover elevation** | Use `hover:[box-shadow:var(--noorix-card-shadow-hover)]` instead of `onMouseEnter` / `style.boxShadow`. |
| 5 | **Auth** | Login card uses `noorix-surface-card noorix-auth-card` (documented exception: larger radius + stronger shadow). |
| 6 | **OCR** | Main shell uses `.ocr-card` / `.ocr-stat-card` in CSS — they consume the same card CSS variables. |
| 7 | **Theme styles** | With `html[data-card-style="1"…"10"]`, verify the screen still looks correct (overrides apply to `.noorix-surface-card`). |
| 8 | **Print** | `@media print` rules strip shadows; no change needed for audit. |

## Documented exceptions

- **Dashed “empty” panels** (e.g. no company, no vault): keep `border-2 border-dashed` on top of `noorix-surface-card`.
- **Promo / callout strips** (e.g. blue dashed banner): intentional border/background override; avoid duplicating default solid border if design uses only dashed (use utility order / single border intent).
- **`noorix-auth-card`**: login only; defined in `src/index.css`.

## Files to grep when auditing

```bash
rg "noorix-surface-card.*(border border-noorix-border|rounded-xl|shadow-sm)" src
rg "noorix-surface-card" src --glob "*.jsx" | rg "style=.*boxShadow"
rg "boxShadow:\\s*['\"]0 " src --glob "*.jsx"
rg "0 1px 4px" src --glob "*.jsx"
```

## ما يُستثنى عادةً (ليس «كرت قسم»)

- **منبثقات / قوائم**: `SupplierSelect`, `ProductSearchInput`, قائمة إجراءات `VaultCard`, `AppHeader` — ظل أقوى للطفو فوق الصفحة.
- **رسوم Recharts**: `ChartTooltip` / `style` داخل `DashboardOverviewTab` وغيرها — أدوات عائمة وليست كروت سطح.
- **محادثة ذكية**: فقاعات الرسائل — نمط محادثة وليس KPI.
- **ThemePreviewScreen** — معاينة أشكال الكرت 1–10 عمداً.
- **Toast** — إشعار عائم.

## References

- Tokens: `src/index.css` (`:root` → `--noorix-card-*`, `.noorix-surface-card`, `.noorix-auth-card`).
- UI rule: `.cursor/rules/ui-components.mdc` — section «كروت السطح».
- Components: `src/ui/Card.jsx`, `src/components/common/SmartTable.jsx`.

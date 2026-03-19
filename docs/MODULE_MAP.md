# خريطة الوحدات (Module Map)

ربط الأقسام بالمسارات والملفات والمواصفات. الوحدات في `src/modules/` لا تستورد من وحدة أخرى؛ الاستيراد فقط من `core`, `utils`, `services`, `context`, `components`, `constants`.

| القسم | المسار | الملفات (واجهة/خدمة) | المواصفة |
|-------|--------|------------------------|----------|
| لوحة المالك | `/owner` | — | [OWNER_DASHBOARD.md](modules/OWNER_DASHBOARD.md) |
| لوحة التحكم | `/` | — | — |
| المحادثة الذكية | `/chat` | — | [SMART_CHAT.md](modules/SMART_CHAT.md) |
| المبيعات | `/sales/new` | `modules/Sales/SalesInvoiceScreen.jsx`, `SalesService.js` | [SALES.md](modules/SALES.md) |
| الفواتير (المشتريات) | `/invoices` | — | [INVOICES_PURCHASES.md](modules/INVOICES_PURCHASES.md) |
| الموردين والتصنيفات | `/suppliers` | — | [SUPPLIERS_CATEGORIES.md](modules/SUPPLIERS_CATEGORIES.md) |
| الخزائن | `/treasury` | — | [TREASURY_VAULTS.md](modules/TREASURY_VAULTS.md) |
| المصاريف الثابتة والمتغيرة | `/expenses` | — | [EXPENSES_FIXED_VARIABLE.md](modules/EXPENSES_FIXED_VARIABLE.md) |
| الطلبات | `/orders` | — | [ORDERS.md](modules/ORDERS.md) |
| مندوب المشتريات | `/purchasing` | — | [PURCHASING_AGENT.md](modules/PURCHASING_AGENT.md) |
| الموارد البشرية | `/hr` | — | [HR.md](modules/HR.md) |
| التقارير | `/reports` | `modules/Reports/ReportsScreen.jsx` | [REPORTS.md](modules/REPORTS.md) |
| الإعدادات | `/settings` | `modules/Settings/SettingsScreen.jsx` | [SETTINGS.md](modules/SETTINGS.md) |
| معاينة الثيم | `/theme-preview` | `modules/ThemePreviewScreen.jsx` | — |

**مشتركات**: `src/core/unifiedTransaction.js`, `src/services/api.js`, `src/context/AppContext.jsx`, `src/hooks/useSales.js`, `src/hooks/useInvoices.js`, `src/hooks/useSuppliers.js`, `src/hooks/useVaults.js`, `src/hooks/useCategories.js`, `src/constants/tax.js`, `src/components/*`.

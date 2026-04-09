# سجل تنظيف الكود الميت — Noorix
**التاريخ:** 2026-04-08  
**الفاحص:** 5 وكلاء متوازيين + تحقق يدوي بـ grep  
**إجمالي السطور المحذوفة:** ~1,107 سطر

---

## منهجية الفحص

1. فحص كل ملف في `src/` بالقراءة المباشرة
2. grep لكل export باتجاهين: من داخل → خارج، ومن خارج → داخل
3. تحقق خاص بعد آخر دفعة commits (MetricCard، color tokens، kpiCardTheme refactor)
4. الحكم: حذف آمن فقط عند ثقة HIGH مع grep مؤكد

---

## P1 — ملفات كاملة محذوفة

| الملف | السطور | السبب |
|-------|--------|--------|
| `src/core/unifiedTransaction.js` | 160 | لا يُستورد في أي ملف تطبيق — فقط في test |
| `src/core/unifiedTransaction.test.js` | 159 | يختبر وظيفة ميتة |

---

## P2 — دوال ميتة في Services

| الملف | العنصر | السبب |
|-------|--------|--------|
| `src/services/api.js` | `getApiBaseUrl()` | لا يُستدعى خارج تعريفه |
| `src/services/authStore.js` | `initAuthStorageListener()` | مبني لمزامنة logout لكن لم يُوصل بعد |
| `src/services/authStore.js` | `broadcastLogout()` | نفسه — لا يُستدعى من أي مكان |

---

## P3 — exports ميتة في Utils وConstants

| الملف | العناصر | السبب |
|-------|--------|--------|
| `src/utils/cacheHelper.js` | `setCache`, `getCache`, `invalidateCache`, `registerRelations`, `clearAllCache`, `invalidateRelated` | لا يُستدعى من التطبيق — `unifiedTransaction` الذي يستخدم `invalidateRelated` نفسه ميت |
| `src/utils/importTemplates.js` | `SUPPLIER_TEMPLATE_COLUMNS`, `downloadSupplierTemplate`, `validateSupplierRows`, `formatSupplierForExport`, `PRODUCT_TEMPLATE_COLUMNS`, `downloadProductTemplate`, `validateProductRows`, `formatProductForExport`, `INVOICE_TEMPLATE_COLUMNS`, `EMPLOYEE_TEMPLATE_COLUMNS`, `parseDate`, `parseBoolean`, `parseNumber` (كـ public exports) | لا يُستورد خارج الملف |
| `src/modules/Settings/constants/settingsConstants.js` | `PERMISSION_LABELS`, `ALL_PERMISSIONS_LIST`, `ROLE_COLORS`, `getRoleColor`, `ROLE_OPTIONS`, `inputStyle` | RolesTab يجلب الصلاحيات من Backend API مباشرة |
| `src/modules/Reports/reportHelpers.js` | `export { CARD_COLORS }` (re-export) | المستهلكون يستوردون من `utils/cardStyles` مباشرة |
| `src/constants/kpiCardTheme.js` | `KPI_CARD_TOP_BAR_CLASS` | deprecated — استُبدل بـ MetricCard.color prop |

---

## P4 — exports ميتة في Hooks

| الهوك | العنصر | السبب |
|--------|--------|--------|
| `useEmployees.js` | `terminate` mutation | StaffListScreen يستخدم `update.mutate({status:'terminated'})` بدلاً منه |
| `useSales.js` | `cancelSummary` mutation | لا يوجد زر إلغاء ملخص في الـ UI |
| `useOwnerReports.js` | `queries` | OwnerDashboardScreen يستخدم `reportsByCompany` فقط |
| `useVaults.js` | `salesChannels` + useMemo | TreasuryScreen يعيد الحساب بنفسه |
| `useCustomAllowances.js` | `create`, `remove` | الكود يستدعي API مباشرة من StaffListScreen/SmartChat |
| `useTableFilter.js` | `reset` | لا يُستدعى من أي consumer |

---

## P5 — barrel exports ميتة في ui/index.js

| Export | السبب |
|--------|--------|
| `Drawer` | يُستخدم داخلياً في AdaptiveSheet بـ direct import |
| `ConnectedTabStrip` | يُستخدم داخلياً في ScreenTabs بـ direct import |
| `useAdaptiveSheetNarrow` | داخلي في AdaptiveSheet فقط |
| `ADAPTIVE_SHEET_BREAKPOINT_PX` | داخلي في AdaptiveSheet فقط |
| `SCREEN_SHELL_PAGE_CLASS` | داخلي في ScreenShell فقط |
| `SCREEN_SHELL_EMBEDDED_CLASS` | داخلي في ScreenShell فقط |
| `SparkLine` | داخلي في MetricCard فقط |
| `SurfaceCard`, `ExecCard`, `StatCard` | لا يُستورد بالاسم من أي ملف تطبيق |
| `BADGE_COLORS` | داخلي في Badge فقط |

---

## P6 — CSS ميت

| الملف | العناصر | السطور |
|-------|--------|--------|
| `src/ui/ui.css` | Block كامل `.nx-kpi-card*` — استُبدل بـ MetricCard | ~235 |
| `src/modules/SmartChat/SmartChatScreen.css` | `.noorix-chat-commands-panel`, `.noorix-chat-commands-backdrop`, `.noorix-chat-commands-panel--portal`, `.noorix-light-sheet` blocks | ~95 |
| `src/index.css` | `noorix-btn-nav`, `noorix-btn-primary`, `noorix-btn` selectors | ~11 |

---

## P7 — Dead imports وi18n

| الملف | العنصر | السبب |
|-------|--------|--------|
| `DashboardCalendarTab.jsx` | `CARD_BORDER_RADIUS` (import فقط) | مستورد ولا يُستخدم في الملف |
| `translations/common.js` | `appTitle`, `appSubtitle` | لا يوجد `t('appTitle')` في كامل src/ |

---

## تحذيرات (لم تُحذف — مراجعة مستقبلية)

- `useTableFilter` → `total`, `totalPages` — مُرجَعان (MEDIUM confidence)
- `ocr.js` translations — الشاشات لم تُهاجَر بالكامل إلى t()
- `.nx-kpi-container` و `.nx-kpi-grid` — **محفوظان** (مستخدمان في JSX)

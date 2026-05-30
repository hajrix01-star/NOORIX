# Noorix Permissions Contract

مصدر الحقيقة للصلاحيات: `backend/src/auth/constants/permissions.ts`  
المصفوفة تُعرض في **الإعدادات → الأدوار** وتُخزَّن في DB. الـ API يفرض الصلاحيات عبر `RolesGuard` + `@RequirePermission` / `@RequireAnyPermission`.

## Phase 0 — ما يُفرض فعلياً (Enforced)

| المورد | قراءة (GET) | كتابة (POST/PUT/PATCH/DELETE) |
|--------|-------------|-------------------------------|
| **RolesGuard** | — | صلاحيات DB فقط؛ لا fallback لـ JWT عند `[]` أو خطأ DB |
| **كشوف البنك** (`/bank-statements`) | `REPORTS_READ` **أو** `VIEW_REPORTS_BANK` | `VIEW_REPORTS_BANK` فقط |
| **VAT planning** (`/vat-planning`) | `HAJRI_TAX_READ` **أو** `REPORTS_READ` | `HAJRI_TAX_WRITE` فقط |
| **تقويم لوحة التحكم** (`/dashboard/calendar`) | `VIEW_DASHBOARD` **أو** `REPORTS_READ` | `VIEW_DASHBOARD` فقط |
| **مسار `/orders`** (frontend) | — | `VIEW_ORDERS` **أو** `STAFF_ORDERS_SUBMIT` **أو** `STAFF_ORDERS_DIGEST` |
| **redirect `/reports`** | — | أول تبويب مسموح (`getFirstAccessibleReportPath`) |
| **تبويبات التقارير** (UI) | — | فلترة حسب `VIEW_REPORTS_*` + fallbacks |

## UI-only (عرض القائمة / مصفوفة الأدوار — لا endpoint مستقل)

| الصلاحية | الغرض |
|----------|--------|
| `VIEW_*` (معظم الأقسام) | إظهار رابط الشريط الجانبي + `PermissionGuard` على المسار |
| `VIEW_REPORTS_GENERAL` … `VIEW_REPORTS_BANK` | تبويبات فرعية داخل `/reports` |
| `VIEW_HR` | دخول شاشة HR مع fallback لـ `HR_*` / `VIEW_EMPLOYEES` |
| `CHAT_FAQ_*` | أسئلة جاهزة في المحادثة الذكية |
| `STAFF_ORDERS_SUBMIT` / `STAFF_ORDERS_DIGEST` | واجهة Staff داخل `/orders` (المدير الكامل يحتاج `VIEW_ORDERS`) |

## fallbacks مقصودة (توافق أدوار قديمة)

| الوصول | يقبل أيضاً |
|--------|-----------|
| تقرير عام | `VIEW_REPORTS`, `REPORTS_READ` |
| تكلفة تطبيقات | `VIEW_REPORTS`, `REPORTS_READ` |
| تقرير ضريبة | `VIEW_REPORTS`, `REPORTS_READ` |
| كشف بنك (UI) | `VIEW_REPORTS`, `REPORTS_READ` |
| HAJRI TAX | `VIEW_REPORTS`, `REPORTS_READ` |
| الأصول | `VIEW_EXPENSES`, `EXPENSES_READ` |

## Roles UI (Settings → الأدوار)

- **محرّر بشاشة كاملة** — accordion لكل قسم في scroll واحد (بدون sidebar).
- **Presets:** محاسب كامل · محاسب بدون خزائن · كاشير — بارزة في الأعلى.
- **المحادثة:** مجموعات (HR · مصروفات · FAQ) مع «تحديد المجموعة».
- **جوال:** select للقسم + checkboxes بارتفاع 44px.

- `@Roles('owner')` → صلاحيات matrix (`*_DELETE`)
- `MANAGE_USERS` على users API
- helper موحّد `useModuleAccess`
- presets أدوار (مثلاً «محاسب بدون خزائن»)
- إخفاء أزرار write في الواجهة حسب صلاحية write

## التحقق اليدوي السريع

1. أزل `REPORTS_READ` من دور → طلب API محمي → **403** (بدون انتظار logout).
2. دور بـ `REPORTS_READ` فقط (بدون `VIEW_REPORTS_BANK`) → رفع كشف → **403**.
3. مستخدم `REPORTS_TAX` فقط → `/reports` → `/reports/tax`.
4. كاشير بـ `STAFF_ORDERS_SUBMIT` → `/orders` يعمل.

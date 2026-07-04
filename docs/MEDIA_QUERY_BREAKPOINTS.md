# عتبات الوسائط في الواجهة (Noorix)

**المرجع التفصيلي للتخطيط والهوامش:** [`.cursor/rules/ui-responsive-standards.mdc`](../.cursor/rules/ui-responsive-standards.mdc)

## عتبات مستخدمة في الكود (`useMediaQuery`)

| الدالة / الاستخدام | عرض النافذة (min-width) | ملاحظة |
|--------------------|-------------------------|--------|
| `useIsMobile640` | `< 640px` مقابل `640px+` | جوال مقابل تابلت/سطح مكتب |
| `useIsNarrow700` | `< 700px` مقابل `700px+` | بطاقات جدول `SmartTable` |
| `useIsNarrow768` | `< 768px` مقابل `768px+` | قائمة المستخدم، سايدبار |

التعريفات الرسمية في `src/ui/responsive.ts`; `src/hooks/useMediaQuery.ts` shim only.

## توافق مع `app-main`

جذور شاشات الأقسام تستخدم `md:` (768px) لهوامش أفقية متوافقة مع حشو `.app-main` — انظر قاعدة «جذر شاشات الأقسام» في نفس ملف المعايير أعلاه.

/**
 * تحميل مسبق (prefetch) لملفات أقسام التطبيق — نفس مسارات import في App.jsx + React.lazy.
 * - تمرير الماوس/التركيز على رابط القائمة (AppSidebar).
 * - بعد تسجيل الدخول: App.jsx يستدعي prefetch لأهم المسارات أثناء requestIdleCallback.
 *
 * ⚠️ عند إضافة Route جديد في App.jsx: أضف هنا نفس () => import(...) مع مفتاح `to` كما في AppSidebar.
 *    للفواتير: استورد المجلد `../modules/Invoices` (index.js) مثل React.lazy في App.jsx.
 */
const routeLoaders = {
  '/owner': () => import('../modules/Owner/OwnerDashboardScreen'),
  '/': () => import('../modules/Dashboard/DashboardScreen'),
  '/chat': () => import('../modules/SmartChat/SmartChatScreen'),
  '/sales': () => import('../modules/Sales/DailySalesScreen'),
  '/purchases': () => import('../modules/Purchases/PurchasesBatchScreen'),
  '/invoices': () => import('../modules/Invoices'),
  '/suppliers': () => import('../modules/Suppliers/SuppliersScreen'),
  '/treasury': () => import('../modules/Treasury/TreasuryScreen'),
  '/expenses': () => import('../modules/Expenses/ExpensesScreen'),
  '/assets': () => import('../modules/Assets/AssetsRegisterScreen'),
  '/orders': () => import('../modules/Orders/OrdersScreen'),
  '/orders-v4': () => import('../modules/OrdersV4/OrdersV4Screen'),
  '/hr': () => import('../modules/HR/HRMainScreen'),
  '/reports': () => import('../modules/Reports/ReportsLayout'),
  '/reports/general': () => import('../modules/Reports/ReportsScreen'),
  '/reports/cost-apps': () => import('../modules/Reports/CostAccountingAppsScreen'),
  '/reports/tax': () => import('../modules/Reports/ReportsTaxScreen'),
  '/reports/bank-statement': () => import('../modules/Reports/BankStatementAnalysisScreen'),
  '/hajri-tax': () => import('../modules/HajriTax/HajriTaxLayout'),
  '/settings': () => import('../modules/Settings/SettingsScreen'),
  '/theme-preview': () => import('../modules/themePreview/ThemePreviewScreen'),
};

/** يمنع استدعاءات متكررة لنفس المسار أثناء التحميل */
type RoutePath = keyof typeof routeLoaders;

const inflight = new Map<RoutePath, Promise<unknown>>();

/**
 * @param {string} to - قيمة `to` في NavLink (مثل '/sales' أو '/')
 */
export function prefetchRouteChunk(to: string) {
  const routePath = String(to) as RoutePath;
  const loader = routeLoaders[routePath];
  if (!loader || typeof window === 'undefined') return;
  if (inflight.has(routePath)) return inflight.get(routePath);
  const promise = loader()
    .catch(() => {
      /* فشل الشبكة — يُعاد المحاولة عند التنقل الفعلي */
    })
    .finally(() => {
      inflight.delete(routePath);
    });
  inflight.set(routePath, promise);
  return promise;
}

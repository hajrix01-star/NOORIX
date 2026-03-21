/**
 * تحميل مسبق (prefetch) لملفات أقسام التطبيق — نفس مسارات import في App.jsx + React.lazy.
 * عند تمرير الماوس على رابط القائمة يبدأ تنزيل الـ chunk في الخلفية؛ عند الضغط يكون غالباً جاهزاً.
 *
 * ⚠️ عند إضافة Route جديد في App.jsx: أضف هنا نفس () => import(...) مع مفتاح `to` كما في AppSidebar.
 */
const routeLoaders = {
  '/owner': () => import('../modules/Owner/OwnerDashboardScreen'),
  '/': () => import('../modules/Dashboard/DashboardScreen'),
  '/chat': () => import('../modules/SmartChat/SmartChatScreen'),
  '/sales': () => import('../modules/Sales/DailySalesScreen'),
  '/purchases': () => import('../modules/Purchases/PurchasesBatchScreen'),
  '/invoices': () => import('../modules/Invoices/InvoicesListScreen'),
  '/suppliers': () => import('../modules/Suppliers/SuppliersScreen'),
  '/treasury': () => import('../modules/Treasury/TreasuryScreen'),
  '/expenses': () => import('../modules/Expenses/ExpensesScreen'),
  '/orders': () => import('../modules/Orders/OrdersScreen'),
  '/hr': () => import('../modules/HR/HRMainScreen'),
  '/reports': () => import('../modules/Reports/ReportsScreen'),
  '/settings': () => import('../modules/Settings/SettingsScreen'),
  '/theme-preview': () => import('../modules/ThemePreviewScreen'),
};

/** يمنع استدعاءات متكررة لنفس المسار أثناء التحميل */
const inflight = new Map();

/**
 * @param {string} to - قيمة `to` في NavLink (مثل '/sales' أو '/')
 */
export function prefetchRouteChunk(to) {
  const loader = routeLoaders[to];
  if (!loader || typeof window === 'undefined') return;
  if (inflight.has(to)) return inflight.get(to);
  const promise = loader().catch(() => {
    /* فشل الشبكة — يُعاد المحاولة عند التنقل الفعلي */
  });
  inflight.set(to, promise);
  return promise;
}

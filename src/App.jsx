import React, { useEffect, useState, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCompanies, getMe, checkApiConnection } from './services/api';
import { setActiveCompanyId } from './services/authStore';
import { AppContext } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import PermissionGuard from './components/PermissionGuard';
import Forbidden403 from './components/Forbidden403';
import AppSidebar from './components/AppSidebar';
import AppHeader from './components/AppHeader';
import LoadingFallback from './components/LoadingFallback';

const DashboardScreen = React.lazy(() => import('./modules/Dashboard/DashboardScreen'));
const DailySalesScreen = React.lazy(() => import('./modules/Sales/DailySalesScreen'));
const PurchasesBatchScreen = React.lazy(() => import('./modules/Purchases/PurchasesBatchScreen'));
const ThemePreviewScreen = React.lazy(() => import('./modules/ThemePreviewScreen'));
const OwnerDashboardScreen = React.lazy(() => import('./modules/Owner/OwnerDashboardScreen'));
const ReportsLayout = React.lazy(() => import('./modules/Reports/ReportsLayout'));
const ReportsScreen = React.lazy(() => import('./modules/Reports/ReportsScreen'));
const ReportsTaxScreen = React.lazy(() => import('./modules/Reports/ReportsTaxScreen'));
const BankStatementAnalysisScreen = React.lazy(() => import('./modules/Reports/BankStatementAnalysisScreen'));
const SettingsScreen = React.lazy(() => import('./modules/Settings/SettingsScreen'));
const LoginScreen = React.lazy(() => import('./modules/Login/LoginScreen'));
const InvoicesListScreen = React.lazy(() => import('./modules/Invoices/InvoicesListScreen'));
const SuppliersScreen = React.lazy(() => import('./modules/Suppliers/SuppliersScreen'));
const TreasuryScreen = React.lazy(() => import('./modules/Treasury/TreasuryScreen'));
const HRMainScreen = React.lazy(() => import('./modules/HR/HRMainScreen'));
const EmployeeProfileScreen = React.lazy(() => import('./modules/HR/EmployeeProfileScreen'));
const ExpensesScreen = React.lazy(() => import('./modules/Expenses/ExpensesScreen'));
const OrdersScreen = React.lazy(() => import('./modules/Orders/OrdersScreen'));
const SmartChatScreen = React.lazy(() => import('./modules/SmartChat/SmartChatScreen'));

const THEME_KEY = 'noorix-theme';
const LANG_KEY = 'noorix-lang';
const CARD_STYLE_KEY = 'noorix-card-style';
function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem(THEME_KEY) || 'light');
}
function getInitialLanguage() {
  if (typeof window === 'undefined') return 'ar';
  const stored = localStorage.getItem(LANG_KEY);
  if (stored === 'ar' || stored === 'en') return stored;
  const lang =
    navigator.language ||
    navigator.userLanguage ||
    (Array.isArray(navigator.languages) ? navigator.languages[0] : 'ar');
  return String(lang).toLowerCase().startsWith('ar') ? 'ar' : 'en';
}
function getInitialCardStyle() {
  if (typeof window === 'undefined') return 1;
  const v = parseInt(localStorage.getItem(CARD_STYLE_KEY) || '1', 10);
  return (v >= 1 && v <= 10) ? v : 1;
}

const FALLBACK_COMPANIES = [
  { id: 'noorix', nameAr: 'شركة Noorix القابضة' },
  { id: 'riyadh', nameAr: 'فرع الرياض' },
  { id: 'jeddah', nameAr: 'فرع جدة' },
];

export default function App() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  const { isAuthenticated, user, setUser, setToken } = useAuth();

  const { isLoading: isMeLoading, isFetched: isMeFetched } = useQuery({
    queryKey: ['me', isAuthenticated],
    queryFn: async () => {
      const res = await getMe();
      if (res?.success && res?.data) {
        setUser(res.data);
        return res.data;
      }
      // فشل التحقق — Token منتهي الصلاحية أو غير صالح
      return null;
    },
    enabled: !!isAuthenticated && !user,
    retry: false,
  });

  // إذا انتهى الاستعلام وما زال المستخدم null → Token فاسد → خروج تلقائي
  useEffect(() => {
    if (isAuthenticated && !user && isMeFetched && !isMeLoading) {
      setToken(null);
    }
  }, [isAuthenticated, user, isMeFetched, isMeLoading, setToken]);

  // المستخدم يُحمَّل إذا كان مصادقاً ولم يصل بعد
  const isUserLoading = isAuthenticated && !user && (isMeLoading || !isMeFetched);

  const { data: companiesFromApi } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      try {
        const res = await getCompanies();
        if (res?.success && Array.isArray(res?.data) && res.data.length > 0) return res.data;
        return null;
      } catch {
        return null;
      }
    },
    enabled: !!isAuthenticated,
  });

  const companiesList = companiesFromApi?.length ? companiesFromApi : FALLBACK_COMPANIES;
  const singleCompanyId = user?.companyIds?.length === 1 ? user.companyIds[0] : null;
  const showCompanySwitcher = !singleCompanyId && companiesList.length > 1;

  const [activeCompany, setActiveCompany] = useState(() => singleCompanyId || (companiesList[0]?.id ?? ''));
  useEffect(() => {
    if (singleCompanyId) setActiveCompany(singleCompanyId);
    else if (companiesList.length && !companiesList.some((c) => c.id === activeCompany)) {
      setActiveCompany(companiesList[0].id);
    }
  }, [singleCompanyId, companiesFromApi, companiesList, activeCompany]);

  const [language, setLanguage] = useState(getInitialLanguage); // 'ar' | 'en'
  const [theme, setTheme] = useState(getInitialTheme); // 'light' | 'dark'
  const [cardStyle, setCardStyle] = useState(getInitialCardStyle); // 1..10
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const companies = companiesList;

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (language === 'ar') {
      root.setAttribute('dir', 'rtl');
      root.setAttribute('lang', 'ar');
      body.style.direction = 'rtl';
    } else {
      root.setAttribute('dir', 'ltr');
      root.setAttribute('lang', 'en');
      body.style.direction = 'ltr';
    }
  }, [language]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_) {}
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-card-style', String(cardStyle));
    try {
      localStorage.setItem(CARD_STYLE_KEY, String(cardStyle));
    } catch (_) {}
  }, [cardStyle]);

  const toggleLanguage = () => {
    setLanguage((prev) => {
      const next = prev === 'ar' ? 'en' : 'ar';
      try { localStorage.setItem(LANG_KEY, next); } catch (_) {}
      return next;
    });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const navigate = useNavigate();
  const handleLogout = () => {
    setToken(null);
    navigate('/login', { replace: true });
  };

  const hasRealCompanies = (companiesFromApi?.length ?? 0) > 0;
  const queryClient = useQueryClient();

  // المرجع الوحيد للشركة النشطة: معرف (id) كـ string — السايدبار والجداول يعتمدونه
  const activeCompanyId = activeCompany;

  const appContextValue = useMemo(
    () => ({
      activeCompany,
      activeCompanyId,
      setActiveCompany,
      companies,
      hasRealCompanies,
      theme,
      setTheme,
      cardStyle,
      setCardStyle,
      language,
      setLanguage,
      isSidebarOpen,
      setSidebarOpen,
      user,
      userRole: user?.role,
      userPermissions: user?.permissions || [],
    }),
    [activeCompany, activeCompanyId, companies, hasRealCompanies, theme, cardStyle, language, isSidebarOpen, user]
  );

  // مزامنة الشركة النشطة مع api.js ليرسل x-company-id في كل طلب
  useEffect(() => {
    setActiveCompanyId(activeCompanyId || '');
  }, [activeCompanyId]);

  // عند تغيير الشركة: إبطال كاش جميع البيانات المرتبطة بالشركة
  useEffect(() => {
    if (!queryClient || !activeCompanyId) return;
    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['vaults'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['sales-summaries'] });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['employees-paged'] });
    queryClient.invalidateQueries({ queryKey: ['purchase-batch-summaries'] });
    queryClient.invalidateQueries({ queryKey: ['sales-summaries-paged'] });
    queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    queryClient.invalidateQueries({ queryKey: ['leaves'] });
    queryClient.invalidateQueries({ queryKey: ['residencies'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['expense-lines'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['order-products'] });
    queryClient.invalidateQueries({ queryKey: ['order-categories'] });
  }, [activeCompanyId, queryClient]);

  // مراقبة حالة الاتصال بالسيرفر
  const [serverDown, setServerDown] = useState(false);
  useEffect(() => {
    if (isLoginPage) return;
    let mounted = true;
    async function probe() {
      const { ok } = await checkApiConnection();
      if (mounted) setServerDown(!ok);
    }
    probe();
    // إعادة الفحص كل 30 ثانية
    const t = setInterval(probe, 30_000);
    return () => { mounted = false; clearInterval(t); };
  }, [isLoginPage]);

  // غير مصادق → صفحة الدخول دائماً
  if (!isAuthenticated && !isLoginPage) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppContext.Provider value={appContextValue}>
      {isLoginPage ? (
        <React.Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--noorix-bg-page)', color: 'var(--noorix-text-muted)' }}>جاري التحميل...</div>}>
          <LoginScreen />
        </React.Suspense>
      ) : (
      <div className="app-shell">
        <AppSidebar
          isOpen={isSidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeCompany={activeCompany}
          setActiveCompany={setActiveCompany}
          companies={companies}
          userRole={user?.role}
          userPermissions={user?.permissions}
          showCompanySwitcher={showCompanySwitcher}
        />
        <div className="app-main" style={serverDown ? { paddingTop: 38 } : {}}>
          <AppHeader
            toggleSidebar={toggleSidebar}
            toggleTheme={toggleTheme}
            toggleLanguage={toggleLanguage}
            theme={theme}
            language={language}
            serverDown={serverDown}
            onRetryConnection={async () => { const { ok } = await checkApiConnection(); setServerDown(!ok); }}
            isAuthenticated={isAuthenticated}
            user={user}
            onLogout={handleLogout}
            companyName={companies?.find((c) => c.id === activeCompany)?.nameAr || companies?.find((c) => c.id === activeCompany)?.name || ''}
          />
        <main className="app-main__content">
          <React.Suspense fallback={<LoadingFallback />}>
            <PermissionGuard userRole={user?.role} userPermissions={user?.permissions} isUserLoading={isUserLoading}>
              <Routes>
                <Route path="/purchasing" element={<Navigate to="/purchases" replace />} />
                <Route path="/theme-preview" element={<ThemePreviewScreen />} />
                <Route path="/403" element={<Forbidden403 />} />
                <Route path="/sales" element={<DailySalesScreen />} />
                <Route path="/sales/new" element={<DailySalesScreen />} />
                <Route path="/purchases" element={<PurchasesBatchScreen />} />
                <Route path="/owner" element={<OwnerDashboardScreen />} />
                <Route path="/chat" element={<SmartChatScreen />} />
                <Route path="/suppliers" element={<SuppliersScreen />} />
                <Route path="/expenses" element={<ExpensesScreen />} />
                <Route path="/orders" element={<OrdersScreen />} />
                <Route path="/invoices" element={<InvoicesListScreen />} />
                <Route path="/treasury" element={<TreasuryScreen />} />
                <Route path="/hr" element={<HRMainScreen />} />
                <Route path="/hr/employee/:id" element={<EmployeeProfileScreen />} />
                <Route path="/reports" element={<ReportsLayout />}>
                  <Route index element={<Navigate to="/reports/general" replace />} />
                  <Route path="general" element={<ReportsScreen />} />
                  <Route path="tax" element={<ReportsTaxScreen />} />
                  <Route path="bank-statement" element={<BankStatementAnalysisScreen />} />
                </Route>
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="/" element={<DashboardScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </PermissionGuard>
          </React.Suspense>
        </main>
        </div>
    </div>
      )}
    </AppContext.Provider>
  );
}


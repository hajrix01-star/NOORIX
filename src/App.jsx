import React, { useEffect, useLayoutEffect, useState, useMemo, useTransition, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCompanies, getMe, checkApiConnection } from './services/api';
import { setActiveCompanyId } from './services/authStore';
import { AppContext } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import PermissionGuard from './components/PermissionGuard';
import Forbidden403 from './components/Forbidden403';
import NotFound404 from './components/NotFound404';
import AppSidebar from './components/AppSidebar';
import AppHeader from './components/AppHeader';
import LoadingFallback from './components/LoadingFallback';
import { prefetchRouteChunk } from './utils/routePrefetch';
import { STORAGE_KEYS, CARD_STYLE_KEY } from './constants/storageKeys';
import { readStoredLanguage, writeStoredLanguage } from './utils/storedLanguage';

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
const AssetsRegisterScreen = React.lazy(() => import('./modules/Assets/AssetsRegisterScreen'));
const OrdersScreen = React.lazy(() => import('./modules/Orders/OrdersScreen'));
const SmartChatScreen = React.lazy(() => import('./modules/SmartChat/SmartChatScreen'));
const OcrInvoicesScreen = React.lazy(() => import('./modules/OcrInvoices/OcrInvoicesScreen'));
const TaxEmbeddedScreen = React.lazy(() => import('./modules/Tax/TaxEmbeddedScreen'));

function getInitialLanguage() {
  if (typeof window === 'undefined') return 'ar';
  const stored = readStoredLanguage();
  if (stored) return stored;
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

export default function App() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  const { isAuthenticated, user, setUser, setToken } = useAuth();

  const { isLoading: isMeLoading, isFetched: isMeFetched } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await getMe();
      if (res?.success && res?.data) {
        setUser(res.data);
        return res.data;
      }
      return null;
    },
    enabled: !!isAuthenticated,
    retry: false,
    staleTime: 3 * 60 * 1000,          // 3 دقائق — لا يُعاد الجلب قبلها
    refetchInterval: 5 * 60 * 1000,     // كل 5 دقائق — يجلب الصلاحيات الحية
    refetchOnWindowFocus: true,          // عند العودة للنافذة — يتحقق فوراً
  });

  // إذا انتهى الاستعلام وما زال المستخدم null → Token فاسد → خروج تلقائي
  useEffect(() => {
    if (isAuthenticated && !user && isMeFetched && !isMeLoading) {
      setToken(null);
    }
  }, [isAuthenticated, user, isMeFetched, isMeLoading, setToken]);

  // المستخدم يُحمَّل إذا كان مصادقاً ولم يصل بعد
  const isUserLoading = isAuthenticated && !user && (isMeLoading || !isMeFetched);

  // بعد الدخول: تحميل مسبق لأهم الأقسام أثناء خمول المتصفح — يقلّل انتظار أول زيارة (lazy chunks)
  useEffect(() => {
    if (!isAuthenticated || !user || isLoginPage) return;
    const routes = ['/', '/sales', '/purchases', '/invoices'];
    const run = () => routes.forEach((to) => prefetchRouteChunk(to));
    let idleId;
    let timeoutId;
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 3000 });
    } else {
      timeoutId = window.setTimeout(run, 600);
    }
    return () => {
      if (idleId != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, isLoginPage, user?.id]);

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

  // لا نستخدم معرفات وهمية (noorix/riyadh…) — كانت تسبب GET /companies/noorix → 500 "No Company found"
  const companiesList = useMemo(() => {
    if (Array.isArray(companiesFromApi) && companiesFromApi.length > 0) {
      return companiesFromApi;
    }
    const ids = user?.companyIds;
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.map((id) => ({ id, nameAr: '', nameEn: null }));
    }
    return [];
  }, [companiesFromApi, user?.companyIds]);
  /** القائمة الفعلية من API قد تتجاوز JWT (مثلاً بعد استيراد شركة) — لا نعتمد على companyIds القديمة لإخفاء المبدّل */
  const singleCompanyId = companiesList.length === 1 ? companiesList[0].id : null;
  const showCompanySwitcher = companiesList.length > 1;

  const [_companySwitchPending, startCompanyTransition] = useTransition();
  const [activeCompany, _setActiveCompany] = useState(() => {
    // استعادة الشركة المختارة من localStorage عند تحديث الصفحة
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY);
      if (saved) return saved;
    } catch (_) {}
    return singleCompanyId || (companiesList[0]?.id ?? '');
  });
  const setActiveCompany = useCallback((id) => {
    startCompanyTransition(() => {
      _setActiveCompany(id);
      try { localStorage.setItem(STORAGE_KEYS.ACTIVE_COMPANY, id); } catch (_) {}
    });
  }, [startCompanyTransition]);
  useEffect(() => {
    // انتظر بيانات API الحقيقية — لا تعتمد على JWT الذي قد لا يحوي كل الشركات
    if (!Array.isArray(companiesFromApi) || companiesFromApi.length === 0) return;

    const savedId = (() => { try { return localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY); } catch { return null; } })();

    if (savedId && companiesFromApi.some((c) => c.id === savedId)) {
      // الشركة المحفوظة صالحة في API → استعدها دائماً
      if (activeCompany !== savedId) _setActiveCompany(savedId);
    } else if (!companiesFromApi.some((c) => c.id === activeCompany)) {
      // الشركة الحالية غير موجودة في API ولا توجد قيمة محفوظة صالحة → اختر الأولى
      setActiveCompany(companiesFromApi[0].id);
    }
  }, [companiesFromApi]);

  const [language, setLanguage] = useState(getInitialLanguage); // 'ar' | 'en'
  const [cardStyle, setCardStyle] = useState(getInitialCardStyle); // 1..10
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const appliedUserLangRef = useRef(null); // تتبع آخر userId طُبِّقت لغته — لمنع التطبيق المتكرر
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
    document.documentElement.setAttribute('data-card-style', String(cardStyle));
    try {
      localStorage.setItem(CARD_STYLE_KEY, String(cardStyle));
    } catch (_) {}
  }, [cardStyle]);

  const applyLanguage = useCallback((lang) => {
    document.documentElement.classList.add('dir-switching');
    setLanguage(lang);
    writeStoredLanguage(lang);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('dir-switching');
      });
    });
  }, []);

  const toggleLanguage = () => applyLanguage(language === 'ar' ? 'en' : 'ar');

  // عند تحميل بيانات المستخدم: طبّق لغته المفضلة مرة واحدة فقط لكل جلسة
  useEffect(() => {
    if (!user?.id || !user?.preferredLang) return;
    if (appliedUserLangRef.current === user.id) return;
    appliedUserLangRef.current = user.id;
    const pref = user.preferredLang === 'en' ? 'en' : 'ar';
    if (pref !== language) applyLanguage(pref);
  }, [user?.id, user?.preferredLang]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const navigate = useNavigate();
  const handleLogout = () => {
    queryClient.clear();
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
    [activeCompany, activeCompanyId, companies, hasRealCompanies, cardStyle, language, isSidebarOpen, user]
  );

  // مزامنة فورية مع api.js قبل الرسم/الطلبات — يقلل خلط x-company-id مع ?companyId
  useLayoutEffect(() => {
    setActiveCompanyId(activeCompanyId || '');
  }, [activeCompanyId]);

  // عند تغيير الشركة: تحديد الاستعلامات كـ stale — البيانات القديمة تبقى مرئية حتى يكتمل التحديث
  useEffect(() => {
    if (!queryClient || !activeCompanyId) return;
    const GLOBAL_KEYS = ['companies', 'me'];
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key)) return false;
        return !GLOBAL_KEYS.includes(key[0]);
      },
      refetchType: 'active',
    });
  }, [activeCompanyId, queryClient]);


  // مراقبة حالة الاتصال بالسيرفر — إعادة فحص عند العودة للتبويب/الشبكة لتفادي بقاء التحذير بعد سبات الجهاز أو إخفاء التبويب
  const [serverDown, setServerDown] = useState(false);
  const connectionProbeMountedRef = useRef(true);
  useEffect(() => {
    connectionProbeMountedRef.current = true;
    return () => { connectionProbeMountedRef.current = false; };
  }, []);

  const probeConnection = useCallback(async () => {
    let { ok } = await checkApiConnection();
    if (!ok) {
      await new Promise((r) => setTimeout(r, 1000));
      if (!connectionProbeMountedRef.current) return;
      const second = await checkApiConnection();
      ok = second.ok;
    }
    if (connectionProbeMountedRef.current) setServerDown(!ok);
  }, []);

  useEffect(() => {
    if (isLoginPage) return;
    probeConnection();
    const t = setInterval(probeConnection, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') probeConnection();
    };
    const onOnline = () => probeConnection();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [isLoginPage, probeConnection]);

  // غير مصادق → صفحة الدخول دائماً
  if (!isAuthenticated && !isLoginPage) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppContext.Provider value={appContextValue}>
      {isLoginPage ? (
        <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-noorix-bg text-noorix-muted">جاري التحميل...</div>}>
          <LoginScreen />
        </React.Suspense>
      ) : (
      <div className="app-shell">
        <AppSidebar
          isOpen={isSidebarOpen}
          onClose={() => setSidebarOpen(false)}
          userRole={user?.role}
          userPermissions={user?.permissions}
        />
        <div className={`app-main${serverDown ? ' pt-[38px]' : ''}`}>
          <AppHeader
            toggleSidebar={toggleSidebar}
            toggleLanguage={toggleLanguage}
            language={language}
            serverDown={serverDown}
            onRetryConnection={probeConnection}
            isAuthenticated={isAuthenticated}
            user={user}
            onLogout={handleLogout}
            activeCompany={companies?.find((c) => c.id === activeCompany) || null}
            companies={companies}
            activeCompanyId={activeCompany}
            setActiveCompany={setActiveCompany}
            showCompanySwitcher={showCompanySwitcher}
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
                <Route path="/assets" element={<AssetsRegisterScreen />} />
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
                <Route path="/ocr" element={<OcrInvoicesScreen />} />
                <Route path="/tax/*" element={<TaxEmbeddedScreen />} />
                <Route path="/" element={<DashboardScreen />} />
                <Route path="*" element={<NotFound404 />} />
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


import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { ToastProvider } from '../context/ToastContext';

const noop = () => {};

/** قيمة AppContext كافية لاختبارات renderHook التي تستدعي useApp / useTranslation */
export const defaultAppTestContextValue = {
  activeCompany: null,
  activeCompanyId: '',
  setActiveCompany: noop,
  companies: [],
  hasRealCompanies: false,
  cardStyle: 'default',
  setCardStyle: noop,
  language: 'ar',
  setLanguage: noop,
  isSidebarOpen: false,
  setSidebarOpen: noop,
  user: { role: 'admin' },
  userRole: 'admin',
  userPermissions: [],
};

/** يقلّل تحذيرات React Router v7 أثناء الاختبارات */
const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

/**
 * غلاف اختبارات: Query + Router + App + Toast
 * @param {{ children: React.ReactNode, initialEntries?: string[], appValue?: object }} props
 */
export function AppTestProviders({ children, initialEntries = ['/'], appValue = defaultAppTestContextValue }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries} future={routerFuture}>
        <AppContext.Provider value={appValue}>
          <ToastProvider>{children}</ToastProvider>
        </AppContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

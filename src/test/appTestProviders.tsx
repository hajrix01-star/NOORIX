import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import type { AppContextValue } from '../context/appTypes';
import type { AuthSessionUser } from '../types/api';
import { ToastProvider } from '../context/ToastContext';

const noop = () => {};

const testUser: AuthSessionUser = {
  id: 'test-user',
  email: 'test@test.local',
  nameAr: '',
  nameEn: null,
  role: 'admin',
  roleNameAr: null,
  permissions: [],
  tenantId: 'test-tenant',
  companyIds: [],
};

/** قيمة AppContext كافية لاختبارات renderHook التي تستدعي useApp / useTranslation */
export const defaultAppTestContextValue: AppContextValue = {
  activeCompany: '',
  activeCompanyId: '',
  setActiveCompany: noop as (id: string) => void,
  companies: [],
  hasRealCompanies: false,
  cardStyle: 1,
  setCardStyle: noop as React.Dispatch<React.SetStateAction<number>>,
  language: 'ar',
  setLanguage: noop as React.Dispatch<React.SetStateAction<string>>,
  isSidebarOpen: false,
  setSidebarOpen: noop as React.Dispatch<React.SetStateAction<boolean>>,
  user: testUser,
  userRole: 'admin',
  userPermissions: [],
};

/** يقلّل تحذيرات React Router v7 أثناء الاختبارات */
const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

type AppTestProvidersProps = {
  children: React.ReactNode;
  initialEntries?: string[];
  appValue?: AppContextValue;
};

/**
 * غلاف اختبارات: Query + Router + App + Toast
 */
export function AppTestProviders({
  children,
  initialEntries = ['/'],
  appValue = defaultAppTestContextValue,
}: AppTestProvidersProps) {
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

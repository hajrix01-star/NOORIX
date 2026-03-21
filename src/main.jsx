import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initGlobalCacheManager } from './utils/cacheHelper';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

initGlobalCacheManager();

/**
 * React Query — توازن بين الأداء والبيانات الحديثة (نمط SaaS شائع):
 * - staleTime قصير نسبياً: إن فات إبطال مفتاح ما، تُحدَّث البيانات خلال ثوانٍ.
 * - refetchOnWindowFocus: عند العودة للتبويب تُعاد جلب الاستعلامات «القديمة» — يقلل شعور «البيانات المتأخرة» بين الأقسام.
 * - بعد كل mutation نستدعي invalidateOnFinancialMutation في الشاشات ذات الصلة.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry(failureCount, error) {
        // لا إعادة على أخطاء HTTP المعروفة
        const code = error?.code ?? error?.response?.status;
        if ([401, 403, 404, 422].includes(code)) return false;
        // إعادة واحدة فقط على أخطاء الشبكة
        if (error?.isNetworkError) return failureCount < 1;
        return failureCount < 1;
      },
      retryDelay: 3000,
    },
    mutations: {
      retry: 0,
    },
  },
});

const container = document.getElementById('root');

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* future flags تُقلّل تحذيرات React Router v7 وتحسّن الأداء */}
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

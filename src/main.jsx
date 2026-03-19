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
 * React Query — إعدادات هادئة:
 * - retry: لا يُعيد المحاولة على أخطاء 401/403/404 (لا فائدة منها).
 * - على أخطاء الشبكة: محاولة واحدة إضافية فقط بعد 3 ثوانٍ.
 * - staleTime: 60 ثانية لتقليل الطلبات المتكررة.
 * - refetchOnWindowFocus: false لتجنب الطلبات عند كل نقر.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
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

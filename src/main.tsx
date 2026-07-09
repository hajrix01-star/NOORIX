import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { applyBranding } from './utils/appBranding';
import { readStoredLanguage } from './utils/storedLanguage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import App from './App';
import './index.css';
import { registerPwa } from './pwa/registerPwa';

registerPwa();

// تطبيق هوية التطبيق باللغة المحفوظة قبل أي رسم
const _storedLang = readStoredLanguage() || 'ar';
applyBranding(_storedLang);

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
      retry(failureCount: number, error: unknown) {
        const err = error as Error & {
          code?: number;
          response?: { status?: number };
          isNetworkError?: boolean;
          isTransientServerError?: boolean;
        };
        const code = err?.code ?? err?.response?.status;
        if (typeof code === 'number' && [401, 403, 404, 422, 429].includes(code)) return false;
        // بوابة / سيرفر نائم — محاولتان إضافيتان بعد فشل إعادة المحاولة داخل apiGet
        if (typeof code === 'number' && [502, 503, 504].includes(code)) return failureCount < 2;
        if (err?.isNetworkError || err?.isTransientServerError) return failureCount < 2;
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
if (!container) throw new Error('Missing #root element');
const routerBaseName = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* future flags تُقلّل تحذيرات React Router v7 وتحسّن الأداء */}
        <BrowserRouter basename={routerBaseName} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

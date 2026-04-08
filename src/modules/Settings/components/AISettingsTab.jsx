/**
 * AISettingsTab — الذكاء المستخدم (Gemini)
 * عرض حالة الاتصال، التشخيص، وزر الفحص الاحترافي
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useTranslation } from '../../../i18n/useTranslation';
import { getHealth, testGemini } from '../../../services/api';
import { Button } from '../../../ui';

const STATUS_ONLINE = 'online';
const STATUS_OFFLINE = 'offline';

export default function AISettingsTab() {
  const { lang } = useTranslation();
  const queryClient = useQueryClient();
  const [lastTestResult, setLastTestResult] = useState(null);

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['health', 'ai-settings'],
    queryFn: async () => {
      const res = await getHealth();
      if (!res.success) return { error: res.error, isNetworkError: res.isNetworkError };
      return res.data;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const testMutation = useApiMutation({
    mutationFn: testGemini,
    invalidateQueries: [['health', 'ai-settings']],
    showErrorToast: false,
    rejectOnApiFailure: false,
    onSuccess: (res) => {
      setLastTestResult(res);
    },
    onError: () => {
      setLastTestResult({ success: false, error: 'فشل الاتصال' });
    },
  });

  const isOnline = healthData && !healthData.error && !healthData.isNetworkError;
  const geminiAvailable = !!healthData?.geminiAvailable;
  const status = isOnline ? STATUS_ONLINE : STATUS_OFFLINE;

  const handleTest = () => {
    setLastTestResult(null);
    testMutation.mutate();
  };

  const handleRefresh = () => {
    setLastTestResult(null);
    refetchHealth();
  };

  return (
    <div className="grid gap-6 max-w-[560px]">
      {/* ─── العنوان والوصف ─── */}
      <div>
        <h2 className="text-[18px] font-bold m-0">
          {lang === 'ar' ? 'المحادثة الذكية — Gemini' : 'Smart Chat — Gemini'}
        </h2>
        <p className="text-[13px] text-noorix-muted mt-2 mb-0 leading-[1.5]">
          {lang === 'ar'
            ? 'يُستخدم Gemini لفهم أسئلتك الطبيعية في المحادثة الذكية. المفتاح يُعرّف في backend/.env ولا يُعرض هنا.'
            : 'Gemini is used to understand natural language in Smart Chat. The API key is set in backend/.env and is not displayed here.'}
        </p>
      </div>

      {/* ─── بطاقة الحالة والتشخيص ─── */}
      <div
        className="noorix-surface-card border border-noorix-border rounded-lg p-5"
        style={{ background: 'var(--noorix-bg)' }}
      >
        {/* شريط الحالة: أونلاين / أوفلاين */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-noorix-border mb-5 pb-4">
          <div className="flex gap-2.5">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: status === STATUS_ONLINE ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)',
                boxShadow: status === STATUS_ONLINE
                  ? '0 0 8px var(--noorix-green-50)'
                  : '0 0 8px rgba(var(--noorix-accent-red-rgb,220,38,38),0.5)',
              }}
              title={status === STATUS_ONLINE ? 'متصل' : 'غير متصل'}
            />
            <span
              className="text-[15px] font-semibold"
              style={{
                color: status === STATUS_ONLINE ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)',
              }}
            >
              {status === STATUS_ONLINE
                ? (lang === 'ar' ? 'أونلاين' : 'Online')
                : (lang === 'ar' ? 'أوفلاين' : 'Offline')}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleRefresh}
              disabled={healthLoading}
            >
              {healthLoading ? (lang === 'ar' ? 'جاري...' : 'Loading...') : (lang === 'ar' ? 'تحديث' : 'Refresh')}
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={handleTest}
              disabled={testMutation.isPending || !isOnline}
            >
              {testMutation.isPending ? (lang === 'ar' ? 'جاري الفحص...' : 'Testing...') : (lang === 'ar' ? 'فحص Gemini' : 'Test Gemini')}
            </Button>
          </div>
        </div>

        {/* التشخيص */}
        <div className="grid gap-3">
          <DiagnosticRow
            label={lang === 'ar' ? 'السيرفر' : 'Backend'}
            value={healthLoading ? (lang === 'ar' ? 'جاري التحقق...' : 'Checking...') : (isOnline ? (lang === 'ar' ? 'متصل' : 'Connected') : (healthData?.error || (lang === 'ar' ? 'غير متصل' : 'Disconnected')))}
            ok={isOnline}
          />
          <DiagnosticRow
            label={lang === 'ar' ? 'مفتاح Gemini' : 'Gemini Key'}
            value={healthLoading ? '—' : (geminiAvailable ? (lang === 'ar' ? 'مُعرّف' : 'Configured') : (lang === 'ar' ? 'غير مُعرّف' : 'Not configured'))}
            ok={geminiAvailable}
          />
          <DiagnosticRow
            label={lang === 'ar' ? 'اختبار API' : 'API Test'}
            value={
              lastTestResult === null
                ? (lang === 'ar' ? '— اضغط "فحص Gemini"' : '— Click "Test Gemini"')
                : lastTestResult?.data?.ok
                  ? (lang === 'ar' ? `يعمل (intent: ${lastTestResult?.data?.intent || '—'})` : `OK (intent: ${lastTestResult?.data?.intent || '—'})`)
                  : (lastTestResult?.data?.error || lastTestResult?.error || (lang === 'ar' ? 'فشل' : 'Failed'))
            }
            ok={lastTestResult?.data?.ok === true}
            pending={lastTestResult === null && !testMutation.isPending}
          />
        </div>
      </div>

      {/* تلميح إعداد المفتاح */}
      {!geminiAvailable && isOnline && (
        <div
          className="p-3 rounded-lg text-[13px] text-noorix-text"
          style={{ background: 'var(--noorix-yellow-12)', border: '1px solid var(--noorix-yellow-40)' }}
        >
          {lang === 'ar'
            ? 'لتفعيل Gemini: أضف GEMINI_API_KEY في backend/.env ثم أعد تشغيل السيرفر. احصل على المفتاح من: https://aistudio.google.com/app/apikey'
            : 'To enable Gemini: Add GEMINI_API_KEY in backend/.env then restart the server. Get key from: https://aistudio.google.com/app/apikey'}
        </div>
      )}
    </div>
  );
}

function DiagnosticRow({ label, value, ok, pending }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-noorix-border rounded-lg py-[10px] px-3" style={{ background: 'var(--noorix-surface)' }}>
      <span className="text-[13px] font-medium text-noorix-muted">{label}</span>
      <div className="flex gap-2">
        <span
          className="text-[13px] font-medium"
          style={{
            color: pending ? 'var(--noorix-text-muted)' : ok ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)',
          }}
        >
          {value}
        </span>
        {!pending && (
          <span
            className="w-[6px] h-[6px] rounded-full"
            style={{ background: ok ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)' }}
          />
        )}
      </div>
    </div>
  );
}

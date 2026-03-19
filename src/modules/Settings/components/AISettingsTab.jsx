/**
 * AISettingsTab — الذكاء المستخدم (Gemini)
 * عرض حالة الاتصال، التشخيص، وزر الفحص الاحترافي
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { getHealth, testGemini } from '../../../services/api';

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

  const testMutation = useMutation({
    mutationFn: testGemini,
    onSuccess: (res) => {
      setLastTestResult(res);
      queryClient.invalidateQueries({ queryKey: ['health', 'ai-settings'] });
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
    <div style={{ display: 'grid', gap: 24, maxWidth: 560 }}>
      {/* ─── العنوان والوصف ─── */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          {lang === 'ar' ? 'المحادثة الذكية — Gemini' : 'Smart Chat — Gemini'}
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--noorix-text-muted)', lineHeight: 1.5 }}>
          {lang === 'ar'
            ? 'يُستخدم Gemini لفهم أسئلتك الطبيعية في المحادثة الذكية. المفتاح يُعرّف في backend/.env ولا يُعرض هنا.'
            : 'Gemini is used to understand natural language in Smart Chat. The API key is set in backend/.env and is not displayed here.'}
        </p>
      </div>

      {/* ─── بطاقة الحالة والتشخيص ─── */}
      <div
        className="noorix-surface-card"
        style={{
          border: '1px solid var(--noorix-border)',
          borderRadius: 8,
          padding: 20,
          background: 'var(--noorix-bg)',
        }}
      >
        {/* شريط الحالة: أونلاين / أوفلاين */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: '1px solid var(--noorix-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: status === STATUS_ONLINE ? 'var(--noorix-accent-green)' : '#dc2626',
                boxShadow: status === STATUS_ONLINE
                  ? '0 0 8px rgba(22,163,74,0.5)'
                  : '0 0 8px rgba(220,38,38,0.5)',
              }}
              title={status === STATUS_ONLINE ? 'متصل' : 'غير متصل'}
            />
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: status === STATUS_ONLINE ? 'var(--noorix-accent-green)' : '#dc2626',
              }}
            >
              {status === STATUS_ONLINE
                ? (lang === 'ar' ? 'أونلاين' : 'Online')
                : (lang === 'ar' ? 'أوفلاين' : 'Offline')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="noorix-btn"
              onClick={handleRefresh}
              disabled={healthLoading}
              style={{
                padding: '8px 14px',
                fontSize: 13,
                background: 'var(--noorix-surface)',
                border: '1px solid var(--noorix-border)',
                borderRadius: 6,
              }}
            >
              {healthLoading ? (lang === 'ar' ? 'جاري...' : 'Loading...') : (lang === 'ar' ? 'تحديث' : 'Refresh')}
            </button>
            <button
              type="button"
              className="noorix-btn"
              onClick={handleTest}
              disabled={testMutation.isPending || !isOnline}
              style={{
                padding: '8px 14px',
                fontSize: 13,
                background: 'var(--noorix-accent-green)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              {testMutation.isPending ? (lang === 'ar' ? 'جاري الفحص...' : 'Testing...') : (lang === 'ar' ? 'فحص Gemini' : 'Test Gemini')}
            </button>
          </div>
        </div>

        {/* التشخيص */}
        <div style={{ display: 'grid', gap: 12 }}>
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
          style={{
            padding: 12,
            background: 'rgba(234,179,8,0.12)',
            border: '1px solid rgba(234,179,8,0.4)',
            borderRadius: 6,
            fontSize: 13,
            color: 'var(--noorix-text)',
          }}
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 12px',
        background: 'var(--noorix-surface)',
        borderRadius: 6,
        border: '1px solid var(--noorix-border)',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--noorix-text-muted)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 13,
            color: pending ? 'var(--noorix-text-muted)' : ok ? 'var(--noorix-accent-green)' : '#dc2626',
            fontWeight: 500,
          }}
        >
          {value}
        </span>
        {!pending && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: ok ? 'var(--noorix-accent-green)' : '#dc2626',
            }}
          />
        )}
      </div>
    </div>
  );
}

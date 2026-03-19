/**
 * LoginScreen — شاشة تسجيل الدخول
 * مستقل عن AppContext لضمان العرض حتى قبل تهيئة السياق.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getText } from '../../i18n/translations';
import { login as apiLogin } from '../../services/api';

function getLang() {
  return (typeof document !== 'undefined' && document.documentElement?.lang === 'en') ? 'en' : 'ar';
}

function t(key) {
  return getText(key, getLang());
}

export default function LoginScreen() {
  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const lang = getLang();
  const isEnglish = lang === 'en';
  const pageDir = isEnglish ? 'ltr' : 'rtl';
  const inlineEnd = isEnglish ? 'right' : 'left';
  const featureItems = [
    t('loginFeature1'),
    t('loginFeature2'),
    t('loginFeature3'),
    t('loginFeature4'),
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError(t('invalidCredentials'));
      return;
    }
    setLoading(true);
    try {
      const res = await apiLogin(email.trim(), password);
      if (!res.success) {
        setError(res.error || t('invalidCredentials'));
        if (res.isNetworkError) setError(t('serverConnectionError'));
        return;
      }
      const { access_token, user } = res.data || {};
      if (!access_token || !user) {
        setError(t('invalidCredentials'));
        return;
      }
      setToken(access_token);
      setUser(user);
      navigate('/sales', { replace: true });
    } catch (err) {
      setError(err?.message || t('serverConnectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px clamp(16px, 4vw, 40px)',
        background: `
          radial-gradient(circle at top right, rgba(37,99,235,0.12), transparent 32%),
          radial-gradient(circle at bottom left, rgba(22,163,74,0.10), transparent 28%),
          linear-gradient(135deg, #f5f7fb 0%, #eef3f9 48%, #f7fafc 100%)
        `,
        direction: pageDir,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 28,
          maxWidth: 1180,
          width: '100%',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            flex: '1 1 420px',
            minWidth: 300,
            maxWidth: 560,
            padding: '14px 8px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              borderRadius: 999,
              border: '1px solid rgba(37,99,235,0.12)',
              background: 'rgba(255,255,255,0.74)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
              marginBottom: 22,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2563eb, #0f172a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: 18,
                boxShadow: '0 12px 24px rgba(37,99,235,0.24)',
              }}
            >
              N
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--noorix-navy)', lineHeight: 1.2 }}>
                Noorix
              </div>
              <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                {t('loginBrandSub')}
              </div>
            </div>
          </div>

          <h1
            style={{
              margin: '0 0 14px',
              fontSize: 'clamp(30px, 5vw, 48px)',
              lineHeight: 1.15,
              fontWeight: 800,
              color: 'var(--noorix-navy)',
              maxWidth: 520,
            }}
          >
            {t('loginWelcome')}
          </h1>

          <p
            style={{
              margin: '0 0 24px',
              fontSize: 16,
              lineHeight: 1.9,
              color: 'var(--noorix-text-muted)',
              maxWidth: 520,
            }}
          >
            {t('loginSubtitle')} {t('loginBadge')}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
              marginBottom: 22,
            }}
          >
            {featureItems.map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '16px 18px',
                  borderRadius: 18,
                  background: 'rgba(255,255,255,0.76)',
                  border: '1px solid rgba(148,163,184,0.18)',
                  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.07)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: 'rgba(22,163,74,0.10)',
                    color: 'var(--noorix-accent-green)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  ✓
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--noorix-text)' }}>
                  {item}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
              color: 'var(--noorix-text-muted)',
              fontSize: 13,
            }}
          >
            <span
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                background: 'rgba(37,99,235,0.08)',
                color: 'var(--noorix-accent-blue)',
                fontWeight: 700,
              }}
            >
              SaaS ERP
            </span>
            <span
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                background: 'rgba(22,163,74,0.08)',
                color: 'var(--noorix-accent-green)',
                fontWeight: 700,
              }}
            >
              Multi-company
            </span>
            <span
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                background: 'rgba(15,23,42,0.06)',
                color: 'var(--noorix-text-muted)',
                fontWeight: 700,
              }}
            >
              Secure Access
            </span>
          </div>
        </div>

        <div
          className="noorix-surface-card"
          style={{
            flex: '0 1 440px',
            minWidth: 300,
            maxWidth: 440,
            padding: 0,
            borderRadius: 24,
            overflow: 'hidden',
            border: '1px solid rgba(148,163,184,0.18)',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.16)',
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              height: 6,
              background: 'linear-gradient(90deg, #2563eb 0%, #16a34a 100%)',
            }}
          />

          <div style={{ padding: '34px clamp(22px, 4vw, 34px) 30px' }}>
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'rgba(37,99,235,0.08)',
                  color: 'var(--noorix-accent-blue)',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  marginBottom: 14,
                }}
              >
                {isEnglish ? 'SECURE LOGIN' : 'دخول آمن'}
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px', color: 'var(--noorix-text)' }}>
                {t('login')}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--noorix-text-muted)', margin: 0, lineHeight: 1.8 }}>
                {t('loginSubtitle')}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--noorix-text)' }}>
                  {t('usernameOrEmail')}
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  autoComplete="username"
                  dir="ltr"
                  style={{
                    width: '100%',
                    height: 50,
                    padding: '0 16px',
                    fontSize: 15,
                    border: '1px solid rgba(148,163,184,0.30)',
                    borderRadius: 14,
                    background: 'rgba(248,250,252,0.92)',
                    color: 'var(--noorix-text)',
                    boxSizing: 'border-box',
                    transition: 'all 160ms ease',
                  }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--noorix-text)' }}>
                  {t('password')}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    dir="ltr"
                    style={{
                      width: '100%',
                      height: 50,
                      paddingTop: 0,
                      paddingBottom: 0,
                      paddingLeft: isEnglish ? 16 : 92,
                      paddingRight: isEnglish ? 92 : 16,
                      fontSize: 15,
                      border: '1px solid rgba(148,163,184,0.30)',
                      borderRadius: 14,
                      background: 'rgba(248,250,252,0.92)',
                      color: 'var(--noorix-text)',
                      boxSizing: 'border-box',
                      transition: 'all 160ms ease',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: 'absolute',
                      [inlineEnd]: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      height: 32,
                      minWidth: 64,
                      padding: '0 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      border: '1px solid rgba(37,99,235,0.14)',
                      borderRadius: 10,
                      background: 'rgba(37,99,235,0.08)',
                      color: 'var(--noorix-accent-blue)',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? t('hidePassword') : t('showPassword')}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    padding: '12px 14px',
                    marginBottom: 16,
                    background: 'rgba(220,38,38,0.08)',
                    border: '1px solid rgba(220,38,38,0.18)',
                    borderRadius: 14,
                    fontSize: 13,
                    color: 'var(--noorix-accent-red)',
                    lineHeight: 1.7,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="noorix-btn-nav"
                style={{
                  width: '100%',
                  minHeight: 54,
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '14px 20px',
                  fontSize: 16,
                  fontWeight: 800,
                  borderRadius: 14,
                  boxShadow: '0 18px 36px rgba(37,99,235,0.24)',
                }}
              >
                {loading ? t('verifying') : t('login')}
              </button>
            </form>

            <div
              style={{
                marginTop: 18,
                paddingTop: 18,
                borderTop: '1px solid rgba(148,163,184,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <p style={{ fontSize: 12, color: 'var(--noorix-text-muted-2)', margin: 0 }}>
                {t('secureSession')}
              </p>
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(22,163,74,0.08)',
                  color: 'var(--noorix-accent-green)',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {isEnglish ? 'Protected access' : 'وصول محمي'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

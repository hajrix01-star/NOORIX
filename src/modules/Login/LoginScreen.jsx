/**
 * LoginScreen — شاشة تسجيل الدخول
 * مستقل عن AppContext لضمان العرض حتى قبل تهيئة السياق.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getText } from '../../i18n/translations';
import { login as apiLogin } from '../../services/api';

function t(key) {
  const lang = (typeof document !== 'undefined' && document.documentElement?.lang === 'en') ? 'en' : 'ar';
  return getText(key, lang);
}

export default function LoginScreen() {
  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        padding: 24,
        background: 'var(--noorix-bg-page)',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 48,
          maxWidth: 900,
          width: '100%',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {/* القسم الأيسر — العلامة والمزايا */}
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--noorix-navy)', margin: '0 0 8px' }}>
              Noorix
            </h1>
            <p style={{ fontSize: 14, color: 'var(--noorix-text-muted)', margin: 0 }}>
              {t('loginBrandSub')}
            </p>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14, color: 'var(--noorix-text-muted)' }}>
            <li style={{ marginBottom: 10 }}>✓ {t('loginFeature1')}</li>
            <li style={{ marginBottom: 10 }}>✓ {t('loginFeature2')}</li>
            <li style={{ marginBottom: 10 }}>✓ {t('loginFeature3')}</li>
            <li style={{ marginBottom: 10 }}>✓ {t('loginFeature4')}</li>
          </ul>
          <p style={{ fontSize: 12, color: 'var(--noorix-text-muted-2)', marginTop: 20 }}>
            {t('loginBadge')}
          </p>
        </div>

        {/* القسم الأيمن — نموذج الدخول */}
        <div
          className="noorix-surface-card"
          style={{
            flex: '1 1 320px',
            minWidth: 280,
            padding: 32,
            borderRadius: 14,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: 'var(--noorix-text)' }}>
            {t('loginWelcome')}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--noorix-text-muted)', margin: '0 0 24px' }}>
            {t('loginSubtitle')}
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--noorix-text)' }}>
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
                  padding: '10px 14px',
                  fontSize: 15,
                  border: '1px solid var(--noorix-border)',
                  borderRadius: 8,
                  background: 'var(--noorix-bg-surface)',
                  color: 'var(--noorix-text)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--noorix-text)' }}>
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
                    padding: '10px 44px 10px 14px',
                    fontSize: 15,
                    border: '1px solid var(--noorix-border)',
                    borderRadius: 8,
                    background: 'var(--noorix-bg-surface)',
                    color: 'var(--noorix-text)',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '4px 8px',
                    fontSize: 12,
                    border: 'none',
                    background: 'transparent',
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
                  padding: 10,
                  marginBottom: 16,
                  background: 'rgba(220,38,38,0.08)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--noorix-accent-red)',
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
                background: 'var(--btn-primary-bg)',
                color: '#fff',
                border: 'none',
                padding: '12px 20px',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {loading ? t('verifying') : t('login')}
            </button>
          </form>

          <p style={{ fontSize: 12, color: 'var(--noorix-text-muted-2)', marginTop: 20 }}>
            {t('secureSession')}
          </p>
        </div>
      </div>
    </div>
  );
}

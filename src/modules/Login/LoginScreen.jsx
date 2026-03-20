/**
 * LoginScreen — شاشة تسجيل الدخول
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getText } from '../../i18n/translations';
import { login as apiLogin } from '../../services/api';

function getLang() {
  return (typeof document !== 'undefined' && document.documentElement?.lang === 'en') ? 'en' : 'ar';
}
function t(key) { return getText(key, getLang()); }

export default function LoginScreen() {
  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const lang      = getLang();
  const isEnglish = lang === 'en';
  const pageDir   = isEnglish ? 'ltr' : 'rtl';
  const inlineEnd = isEnglish ? 'right' : 'left';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError(t('invalidCredentials')); return; }
    setLoading(true);
    try {
      const res = await apiLogin(email.trim(), password);
      if (!res.success) {
        setError(res.isNetworkError ? t('serverConnectionError') : (res.error || t('invalidCredentials')));
        return;
      }
      const { access_token, user } = res.data || {};
      if (!access_token || !user) { setError(t('invalidCredentials')); return; }
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
      dir={pageDir}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(20px, 5vw, 48px) 16px',
        background: `
          radial-gradient(circle at 20% 20%, rgba(37,99,235,0.10) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(22,163,74,0.08) 0%, transparent 50%),
          var(--noorix-bg-muted, #f1f5f9)
        `,
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* ── الشعار واسم الشركة ── */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, #2563eb 0%, #0f172a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 12px 32px rgba(37,99,235,0.28)',
          }}>
            <span style={{ color: '#fff', fontSize: 28, fontWeight: 900, lineHeight: 1 }}>N</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--noorix-navy, #0f172a)', letterSpacing: '-0.3px' }}>
            Noorix
          </div>
          <div style={{ fontSize: 13, color: 'var(--noorix-text-muted)', marginTop: 4 }}>
            {t('loginBrandSub')}
          </div>
        </div>

        {/* ── بطاقة تسجيل الدخول ── */}
        <div style={{
          background: 'var(--noorix-bg-surface, #fff)',
          border: '1px solid var(--noorix-border)',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(15,23,42,0.12)',
          overflow: 'hidden',
        }}>
          {/* شريط لوني علوي */}
          <div style={{ height: 4, background: 'linear-gradient(90deg, #2563eb 0%, #16a34a 100%)' }} />

          <div style={{ padding: 'clamp(24px, 5vw, 36px)' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', color: 'var(--noorix-text)' }}>
              {t('login')}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--noorix-text-muted)', margin: '0 0 24px' }}>
              {t('loginSubtitle')}
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {/* البريد الإلكتروني */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--noorix-text)' }}>
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
                    width: '100%', height: 50, padding: '0 14px', fontSize: 15,
                    border: '1.5px solid var(--noorix-border)',
                    borderRadius: 12,
                    background: 'var(--noorix-bg-muted, #f8fafc)',
                    color: 'var(--noorix-text)',
                    boxSizing: 'border-box',
                    transition: 'border-color 150ms',
                    outline: 'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={(e)  => { e.target.style.borderColor = 'var(--noorix-border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* كلمة المرور */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--noorix-text)' }}>
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
                      width: '100%', height: 50,
                      paddingTop: 0, paddingBottom: 0,
                      paddingLeft: isEnglish ? 14 : 80,
                      paddingRight: isEnglish ? 80 : 14,
                      fontSize: 15,
                      border: '1.5px solid var(--noorix-border)',
                      borderRadius: 12,
                      background: 'var(--noorix-bg-muted, #f8fafc)',
                      color: 'var(--noorix-text)',
                      boxSizing: 'border-box',
                      transition: 'border-color 150ms',
                      outline: 'none',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={(e)  => { e.target.style.borderColor = 'var(--noorix-border)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: 'absolute', [inlineEnd]: 10, top: '50%',
                      transform: 'translateY(-50%)',
                      height: 30, minWidth: 58, padding: '0 8px', fontSize: 12, fontWeight: 700,
                      border: '1px solid rgba(37,99,235,0.16)',
                      borderRadius: 8,
                      background: 'rgba(37,99,235,0.07)',
                      color: 'var(--noorix-accent-blue)',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? t('hidePassword') : t('showPassword')}
                  </button>
                </div>
              </div>

              {/* خطأ */}
              {error && (
                <div style={{
                  padding: '11px 14px', marginBottom: 16,
                  background: 'rgba(220,38,38,0.07)',
                  border: '1px solid rgba(220,38,38,0.18)',
                  borderRadius: 10, fontSize: 13,
                  color: '#dc2626', lineHeight: 1.7,
                }}>
                  {error}
                </div>
              )}

              {/* زر الدخول */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', minHeight: 52,
                  background: loading
                    ? 'rgba(37,99,235,0.6)'
                    : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#fff', border: 'none',
                  borderRadius: 12, fontSize: 16, fontWeight: 800,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 24px rgba(37,99,235,0.28)',
                  transition: 'opacity 150ms',
                  fontFamily: 'var(--noorix-font-primary)',
                }}
              >
                {loading ? t('verifying') : t('login')}
              </button>
            </form>
          </div>
        </div>

        {/* ── تذييل بسيط ── */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--noorix-text-muted)' }}>
          {t('secureSession')} &nbsp;·&nbsp; Noorix © {new Date().getFullYear()}
        </p>

      </div>
    </div>
  );
}

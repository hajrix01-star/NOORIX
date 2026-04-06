/**
 * LoginScreen — شاشة تسجيل الدخول
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getText } from '../../i18n/translations';
import { login as apiLogin } from '../../services/api';
import { getBrandName, getBrandLogo, getBrandTagline, getBrandColor, getLoginDomain } from '../../utils/appBranding';
import { Button, Input } from '../../ui';

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

  const brandLogo    = getBrandLogo();
  const brandName    = getBrandName(lang);
  const brandTagline = getBrandTagline(lang);
  const brandColor   = getBrandColor();
  const loginDomain  = getLoginDomain();

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
      className="nx-flex-center"
      style={{
        minHeight: '100vh',
        justifyContent: 'center',
        padding: 'clamp(20px, 5vw, 48px) 16px',
        background: `
          radial-gradient(circle at 20% 20%, rgba(37,99,235,0.10) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(22,163,74,0.08) 0%, transparent 50%),
          var(--noorix-bg-muted, #f1f5f9)
        `,
      }}
    >
      <div className="nx-w-full" style={{ maxWidth: 420 }}>

        {/* ── الشعار واسم التطبيق ── */}
        <div className="nx-text-center" style={{ marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            gap: 14, marginBottom: 10,
          }}>
            {/* أيقونة الشعار */}
            <div className="nx-overflow-hidden" style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: brandLogo ? 'transparent' : `linear-gradient(135deg, ${brandColor} 0%, #0f172a 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 28px rgba(37,99,235,0.22)',
            }}>
              {brandLogo
                ? <img src={brandLogo} alt={brandName} className="nx-w-full" style={{ height: '100%', objectFit: 'cover' }} />
                : <span style={{ color: '#fff', fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{brandName?.[0] || 'N'}</span>
              }
            </div>
            {/* الاسم */}
            <div style={{ textAlign: isEnglish ? 'left' : 'right' }}>
              <div className="nx-font-800 nx-text-primary" style={{ fontSize: 24, letterSpacing: '-0.3px', lineHeight: 1.1 }}>
                {brandName}
              </div>
              <div className="nx-text-sm nx-text-muted" style={{ marginTop: 3 }}>
                {brandTagline || t('loginBrandSub')}
              </div>
            </div>
          </div>
        </div>

        {/* ── بطاقة تسجيل الدخول ── */}
        <div className="nx-bg-surface nx-border-all nx-overflow-hidden" style={{
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(15,23,42,0.12)',
        }}>
          {/* شريط لوني علوي */}
          <div style={{ height: 4, background: 'linear-gradient(90deg, #2563eb 0%, #16a34a 100%)' }} />

          <div style={{ padding: 'clamp(24px, 5vw, 36px)' }}>
            <h2 className="nx-font-800 nx-text-primary" style={{ fontSize: 20, margin: '0 0 6px' }}>
              {t('login')}
            </h2>
            <p className="nx-text-base nx-text-muted" style={{ margin: '0 0 24px' }}>
              {t('loginSubtitle')}
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {/* البريد الإلكتروني */}
              <div className="nx-mb-16">
                <div className="nx-flex-between nx-mb-6">
                  <label className="nx-text-base nx-font-700 nx-text-primary">
                    {t('usernameOrEmail')}
                  </label>
                  {loginDomain && (
                    <span className="nx-text-xs nx-text-muted nx-ltr" style={{ fontFamily: 'monospace' }}>
                      @{loginDomain}
                    </span>
                  )}
                </div>
                <Input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`user@${loginDomain}`}
                  autoComplete="username"
                  dir="ltr"
                  className="nx-w-full"
                  style={{
                    height: 50, padding: '0 14px', fontSize: 15,
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
              <div className="nx-mb-20">
                <label className="nx-text-base nx-font-700 nx-text-primary" style={{ display: 'block', marginBottom: 6 }}>
                  {t('password')}
                </label>
                <div style={{ position: 'relative' }}>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    dir="ltr"
                    className="nx-w-full"
                    style={{
                      height: 50,
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
                  <Button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: 'absolute', [inlineEnd]: 10, top: '50%',
                      transform: 'translateY(-50%)',
                      height: 30, minWidth: 58, padding: '0 8px', fontSize: 12, fontWeight: 700,
                    }}
                  >
                    {showPassword ? t('hidePassword') : t('showPassword')}
                  </Button>
                </div>
              </div>

              {/* خطأ */}
              {error && (
                <div className="nx-mb-16 nx-text-base" style={{
                  padding: '11px 14px',
                  background: 'rgba(220,38,38,0.07)',
                  border: '1px solid rgba(220,38,38,0.18)',
                  borderRadius: 10,
                  color: '#dc2626', lineHeight: 1.7,
                }}>
                  {error}
                </div>
              )}

              {/* زر الدخول */}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={loading}
                loading={loading}
              >
                {loading ? t('verifying') : t('login')}
              </Button>
            </form>
          </div>
        </div>

        {/* ── تذييل بسيط ── */}
        <p className="nx-text-center nx-text-sm nx-text-muted nx-mt-20">
          {t('secureSession')} &nbsp;·&nbsp; Noorix © {new Date().getFullYear()}
        </p>

      </div>
    </div>
  );
}

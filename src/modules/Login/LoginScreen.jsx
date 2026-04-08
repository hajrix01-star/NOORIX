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
      dir={isEnglish ? 'ltr' : 'rtl'}
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        background: `
          radial-gradient(circle at 20% 20%, var(--noorix-blue-10) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, var(--noorix-green-8) 0%, transparent 50%),
          var(--noorix-bg-muted, #f1f5f9)
        `,
      }}
    >
      <div className="w-full max-w-[420px]">

        {/* الشعار */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3.5">
            <div
              className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center overflow-hidden"
              style={{
                background: brandLogo ? 'transparent' : `linear-gradient(135deg, ${brandColor} 0%, #0f172a 100%)`,
                boxShadow: '0 10px 28px rgba(37,99,235,0.22)',
              }}
            >
              {brandLogo
                ? <img src={brandLogo} alt={brandName} className="w-full h-full object-cover" />
                : <span className="text-white text-[24px] font-black">{brandName?.[0] || 'N'}</span>
              }
            </div>
            <div className={isEnglish ? 'text-start' : 'text-end'}>
              <div className="text-[24px] font-extrabold text-noorix-text tracking-tight leading-tight">
                {brandName}
              </div>
              <div className="text-[12px] text-noorix-muted mt-0.5">
                {brandTagline || t('loginBrandSub')}
              </div>
            </div>
          </div>
        </div>

        {/* بطاقة تسجيل الدخول */}
        <div className="noorix-surface-card noorix-auth-card overflow-hidden">
          {/* شريط لوني علوي */}
          <div className="h-1 bg-gradient-to-r from-noorix-blue to-noorix-green" />

          <div className="p-6 sm:p-8">
            <h2 className="text-[20px] font-extrabold text-noorix-text m-0 mb-1.5">
              {t('login')}
            </h2>
            <p className="text-[13px] text-noorix-muted m-0 mb-6">
              {t('loginSubtitle')}
            </p>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              {/* البريد الإلكتروني */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-bold text-noorix-text">{t('usernameOrEmail')}</span>
                  {loginDomain && (
                    <span className="text-[11px] text-noorix-muted ltr" style={{ fontFamily: 'monospace' }}>
                      @{loginDomain}
                    </span>
                  )}
                </div>
                <Input
                  type="text"
                  size="lg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`user@${loginDomain}`}
                  autoComplete="username"
                  dir="ltr"
                />
              </div>

              {/* كلمة المرور */}
              <div>
                <label className="text-[13px] font-bold text-noorix-text block mb-1.5">
                  {t('password')}
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    size="lg"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    dir="ltr"
                    className={isEnglish ? 'pe-20' : 'ps-20'}
                  />
                  <Button
                    variant="raw"
                    size="sm"
                    onClick={() => setShowPassword((v) => !v)}
                    className={`absolute ${isEnglish ? 'end-2.5' : 'start-2.5'} top-1/2 -translate-y-1/2 px-2 font-bold text-noorix-muted hover:text-noorix-text hover:bg-noorix-bg-muted`}
                  >
                    {showPassword ? t('hidePassword') : t('showPassword')}
                  </Button>
                </div>
              </div>

              {/* خطأ */}
              {error && (
                <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-[13px] text-noorix-red leading-relaxed">
                  {error}
                </div>
              )}

              {/* زر الدخول */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={loading}
                loading={loading}
              >
                {loading ? t('verifying') : t('login')}
              </Button>
            </form>
          </div>
        </div>

        {/* تذييل */}
        <p className="text-center text-[12px] text-noorix-muted mt-5">
          {t('secureSession')} &nbsp;·&nbsp; Noorix © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

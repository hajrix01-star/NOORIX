/**
 * LoginScreen — شاشة تسجيل الدخول
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getText } from '../../i18n/translations';
import { login as apiLogin } from '../../services/api';
import { getBrandName, getBrandLogo, getBrandTagline, getBrandColor, getLoginDomain } from '../../utils/appBranding';
import { Button, Input, cn } from '../../ui';

function getLang() {
  return (typeof document !== 'undefined' && document.documentElement?.lang === 'en') ? 'en' : 'ar';
}
function t(key: any) { return getText(key, getLang()); }

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

  /** بريد كامل أو اسم مستخدم + نطاق الهوية (نفس السجل في قاعدة البيانات كبريد). */
  const resolveLoginIdentifier = (raw: any) => {
    const s = raw.trim();
    if (!s) return s;
    if (s.includes('@')) return s;
    const domain = (loginDomain || '').trim();
    return domain ? `${s}@${domain}` : s;
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError(t('invalidCredentials')); return; }
    setLoading(true);
    try {
      const res = await apiLogin(resolveLoginIdentifier(email), password);
      if (!res.success) {
        setError(res.isNetworkError ? t('serverConnectionError') : (res.error || t('invalidCredentials')));
        return;
      }
      const { access_token, user } = res.data || {};
      if (!access_token || !user) { setError(t('invalidCredentials')); return; }
      setToken(access_token);
      setUser(user);
      navigate('/sales', { replace: true });
    } catch (err: any) {
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

          <div className="p-6 sm:p-8 text-left">
            <h2 className="text-[20px] font-extrabold text-noorix-text m-0 mb-1.5 text-left">
              {t('login')}
            </h2>
            <p className="text-[13px] text-noorix-muted m-0 mb-6 text-left">
              {t('loginSubtitle')}
            </p>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 text-left">
              {/* اسم المستخدم أو البريد */}
              <div>
                <label className="text-[13px] font-bold text-noorix-text block mb-1.5 text-left">
                  {t('usernameOrEmail')}
                </label>
                <Input
                  type="text"
                  size="lg"
                  value={email}
                  onChange={(e: any) => setEmail(e.target.value)}
                  autoComplete="username"
                  dir="ltr"
                  className="text-left"
                />
              </div>

              {/* كلمة المرور — حقل LTR مع زر إظهار على يمين الصندوق */}
              <div>
                <label className="text-[13px] font-bold text-noorix-text block mb-1.5 text-left">
                  {t('password')}
                </label>
                <div className="relative" dir="ltr">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    size="lg"
                    value={password}
                    onChange={(e: any) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    dir="ltr"
                    className={cn('pe-20 text-left')}
                  />
                  <Button
                    type="button"
                    variant="raw"
                    size="sm"
                    onClick={() => setShowPassword((v: any) => !v)}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 px-2 font-bold text-noorix-muted hover:text-noorix-text hover:bg-noorix-bg-muted"
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
        <p className="text-left text-[12px] text-noorix-muted mt-5">
          Noorix © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

/**
 * AppHeader — شريط الهيدر العلوي
 * تصميم احترافي: logo | company name | user avatar
 */
import React from 'react';
import { useTranslation } from '../i18n/useTranslation';
import UserMenu from './UserMenu';
import { Button } from '../ui';

export default function AppHeader({
  toggleSidebar, toggleTheme, toggleLanguage,
  theme, language, serverDown, onRetryConnection,
  isAuthenticated, user, onLogout,
  activeCompany,
}) {
  const { t, lang } = useTranslation();

  const coName = activeCompany
    ? (lang === 'en'
        ? (activeCompany.nameEn || activeCompany.nameAr || '')
        : (activeCompany.nameAr || activeCompany.nameEn || ''))
    : '';
  const coLogo    = activeCompany?.logoUrl || '';
  const coInitial = coName?.[0] || '';

  return (
    <>
      {/* شريط تحذير انقطاع الاتصال */}
      {serverDown && (
        <div
          role="alert"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            zIndex: 'var(--nx-z-top, 9999)',
            background: '#991b1b', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, padding: '6px 16px',
            fontSize: 13, fontWeight: 600,
          }}
        >
          <span>{t('serverDown')}</span>
          <Button variant="ghost" size="sm" onClick={onRetryConnection}>
            {t('retry')}
          </Button>
        </div>
      )}

      <header className="noorix-topbar">
        {/* ── يسار: هامبرجر + شعار ── */}
        <div className="noorix-topbar__left">
          <Button
            className="nx-shell-icon-btn app-main__menu-button"
            onClick={toggleSidebar}
            aria-label={t('sidebarMenu')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1" y="2.5" width="14" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="1" y="12" width="14" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </Button>
          <span className="noorix-topbar__logo">Noorix</span>
        </div>

        {/* ── مركز: اسم الشركة ── */}
        <div className="noorix-topbar__center">
          {coName && (
            <>
              {coLogo ? (
                <img
                  src={coLogo}
                  alt={coName}
                  className="noorix-topbar__co-logo"
                />
              ) : coInitial ? (
                <span className="noorix-topbar__co-initial">
                  {coInitial}
                </span>
              ) : null}
              <span className="noorix-topbar__company">{coName}</span>
            </>
          )}
        </div>

        {/* ── يمين: زر المستخدم ── */}
        <div className="noorix-topbar-actions">
          {isAuthenticated && user && (
            <UserMenu
              user={user}
              onLogout={onLogout}
              theme={theme}
              toggleTheme={toggleTheme}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          )}
        </div>
      </header>
    </>
  );
}

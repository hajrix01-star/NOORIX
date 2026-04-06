/**
 * AppHeader — شريط الهيدر العلوي
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
  const coLogo = activeCompany?.logoUrl || '';
  const coInitial = coName?.[0] || '';

  return (
    <>
      {serverDown && (
        <div role="alert" className="nx-text-base nx-font-600 nx-text-center nx-flex-center nx-gap-10 nx-py-8 nx-px-16" style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#991b1b', color: '#fff',
          justifyContent: 'center',
        }}>
          <span>{t('serverDown')}</span>
          <Button variant="ghost" size="sm" onClick={onRetryConnection}>
            {t('retry')}
          </Button>
        </div>
      )}
      <header className="noorix-topbar">
        <div className="noorix-topbar__left">
          <Button
            className="nx-shell-icon-btn app-main__menu-button"
            onClick={toggleSidebar}
            aria-label={t('sidebarMenu')}
          >
            ☰
          </Button>
          <span className="noorix-topbar__logo">Noorix</span>
        </div>
        <div className="noorix-topbar__center">
          {coName && (
            <div className="nx-flex-center nx-gap-8">
              {coLogo ? (
                <img
                  src={coLogo}
                  alt={coName}
                  style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : coInitial ? (
                <div className="nx-text-sm nx-font-800" style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(37,99,235,0.8) 0%, rgba(16,163,74,0.6) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff',
                }}>
                  {coInitial}
                </div>
              ) : null}
              <span className="noorix-topbar__company">{coName}</span>
            </div>
          )}
        </div>
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

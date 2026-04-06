/**
 * AppHeader — شريط الهيدر العلوي
 */
import React from 'react';
import { useTranslation } from '../i18n/useTranslation';
import UserMenu from './UserMenu';

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
        <div role="alert" style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#991b1b', color: '#fff', fontSize: 13, fontWeight: 600,
          padding: '8px 16px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <span>⚠️ {t('serverDown')}</span>
          <button
            type="button"
            onClick={onRetryConnection}
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, color: '#fff', padding: '6px 14px', cursor: 'pointer', fontSize: 13, minHeight: 36, fontFamily: 'inherit' }}
          >
            {t('retry')}
          </button>
        </div>
      )}
      <header className="noorix-topbar">
        <div className="noorix-topbar__left">
          <button
            type="button"
            className="app-main__menu-button"
            onClick={toggleSidebar}
            aria-label={t('sidebarMenu')}
          >
            ☰
          </button>
          <span className="noorix-topbar__logo">Noorix</span>
        </div>
        <div className="noorix-topbar__center">
          {coName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {coLogo ? (
                <img
                  src={coLogo}
                  alt={coName}
                  style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : coInitial ? (
                <div style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(37,99,235,0.8) 0%, rgba(16,163,74,0.6) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: '#fff',
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

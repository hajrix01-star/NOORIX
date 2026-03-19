/**
 * AppHeader — شريط الهيدر العلوي
 */
import React from 'react';
import { useTranslation } from '../i18n/useTranslation';
import UserMenu from './UserMenu';

export default function AppHeader({ toggleSidebar, toggleTheme, toggleLanguage, theme, language, serverDown, onRetryConnection, isAuthenticated, user, onLogout, companyName }) {
  const { t } = useTranslation();
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
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, color: '#fff', padding: '2px 10px', cursor: 'pointer', fontSize: 12 }}
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
          {companyName && (
            <span className="noorix-topbar__company">{companyName}</span>
          )}
        </div>
        <div className="noorix-topbar-actions">
          <button
            type="button"
            onClick={toggleTheme}
            className="noorix-topbar-btn"
            title={theme === 'light' ? t('darkMode') : t('lightMode')}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button type="button" onClick={toggleLanguage} className="noorix-topbar-btn" title={language === 'ar' ? t('switchToEnglish') : t('switchToArabic')} aria-label={language === 'ar' ? t('switchToEnglish') : t('switchToArabic')}>
            {language === 'ar' ? 'AR' : 'EN'}
          </button>
          {isAuthenticated && user && (
            <UserMenu user={user} onLogout={onLogout} />
          )}
        </div>
      </header>
    </>
  );
}

/**
 * AppHeader — شريط الهيدر العلوي
 */
import React from 'react';
import { useTranslation } from '../i18n/useTranslation';
import UserMenu from './UserMenu';
import { Button } from '../ui';

export default function AppHeader({
  toggleSidebar, toggleLanguage,
  language, serverDown, onRetryConnection,
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
          className="fixed top-0 start-0 end-0 z-[9999] flex items-center justify-center gap-2.5 px-4 py-1.5 bg-[#991b1b] text-white text-[13px] font-semibold"
        >
          <span>{t('serverDown')}</span>
          <Button variant="ghost" size="sm" onClick={onRetryConnection} className="!text-white !border-white/40 hover:!bg-white/10">
            {t('retry')}
          </Button>
        </div>
      )}

      <header className="noorix-topbar flex items-center justify-between gap-2 h-14 px-3 bg-[var(--noorix-topbar-bg)] border-b border-[var(--noorix-topbar-border)] shrink-0">
        {/* يسار: هامبرجر + شعار */}
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            aria-label={t('sidebarMenu')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1" y="2.5" width="14" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="1" y="12" width="14" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </Button>
          <span className="text-[16px] font-bold text-noorix-navy">Noorix</span>
        </div>

        {/* مركز: اسم الشركة */}
        <div className="flex items-center gap-2 flex-1 justify-center min-w-0 px-2">
          {coName && (
            <>
              {coLogo ? (
                <img src={coLogo} alt={coName} className="w-6 h-6 rounded object-contain shrink-0" />
              ) : coInitial ? (
                <span className="w-6 h-6 rounded bg-noorix-navy text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {coInitial}
                </span>
              ) : null}
              <span className="text-[13px] font-semibold text-noorix-text truncate">{coName}</span>
            </>
          )}
        </div>

        {/* يمين: قائمة المستخدم */}
        <div className="flex items-center gap-2 shrink-0">
          {isAuthenticated && user && (
            <UserMenu
              user={user}
              onLogout={onLogout}
              language={language}
              toggleLanguage={toggleLanguage}
            />
          )}
        </div>
      </header>
    </>
  );
}

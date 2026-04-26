/**
 * AppHeader — شريط الهيدر العلوي
 * يحتوي على: هامبرجر + شعار | مبدّل الشركة | قائمة المستخدم
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { CompanyListItem } from '../context/appTypes';
import type { AuthSessionUser } from '../types/api';
import { useTranslation } from '../i18n/useTranslation';
import UserMenu from './UserMenu';
import { Button, Modal } from '../ui';

const MENU_WIDTH = 220;

export type AppHeaderProps = {
  toggleSidebar: () => void;
  toggleLanguage: () => void;
  language: string;
  serverDown: boolean;
  onRetryConnection: () => void | Promise<void>;
  isAuthenticated: boolean;
  user: AuthSessionUser | null;
  onLogout: () => void;
  activeCompany: CompanyListItem | null;
  companies?: CompanyListItem[];
  activeCompanyId: string;
  setActiveCompany: (id: string) => void;
  showCompanySwitcher?: boolean;
};

export default function AppHeader({
  toggleSidebar,
  toggleLanguage,
  language,
  serverDown,
  onRetryConnection,
  isAuthenticated,
  user,
  onLogout,
  activeCompany,
  companies = [],
  activeCompanyId,
  setActiveCompany,
  showCompanySwitcher = false,
}: AppHeaderProps) {
  const { t, lang } = useTranslation();

  const activeCo = companies.find((c: any) => c.id === activeCompanyId) || activeCompany || null;
  const coName = activeCo
    ? (lang === 'en'
        ? (activeCo.nameEn || activeCo.nameAr || '')
        : (activeCo.nameAr || activeCo.nameEn || ''))
    : '';
  const coLogo    = activeCo?.logoUrl || '';
  const coInitial = coName?.[0] || '';

  /* ── Dropdown الشركة ── */
  /* ── تأكيد تبديل الشركة ── */
  const [pendingCompany, setPendingCompany] = useState<string | null>(null);
  const pendingCo   = pendingCompany ? companies.find((c: any) => c.id === pendingCompany) : null;
  const pendingName = pendingCo
    ? (lang === 'en' ? pendingCo.nameEn || pendingCo.nameAr : pendingCo.nameAr || pendingCo.nameEn) || '—'
    : '';

  const [coDropOpen, setCoDropOpen] = useState(false);
  const coDropBtnRef = useRef<HTMLButtonElement | null>(null);
  const coDropMenuRef = useRef<HTMLDivElement | null>(null);
  const [coDropPos, setCoDropPos] = useState({ top: 0, left: 0, width: MENU_WIDTH });

  const updateCoDropPos = useCallback(() => {
    const el = coDropBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.max(r.width, MENU_WIDTH);
    let left = r.right - w;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    setCoDropPos({ top: r.bottom + 4, left, width: w });
  }, []);

  useEffect(() => {
    if (!coDropOpen) return;
    updateCoDropPos();
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (
        t &&
        !coDropBtnRef.current?.contains(t) &&
        !coDropMenuRef.current?.contains(t)
      ) {
        setCoDropOpen(false);
      }
    };
    const close = () => setCoDropOpen(false);
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [coDropOpen, updateCoDropPos]);

  const handleCompanySelect = (id: string) => {
    setCoDropOpen(false);
    if (id && id !== activeCompanyId) setPendingCompany(id);
  };

  const confirmSwitch = () => {
    if (pendingCompany) { setActiveCompany?.(pendingCompany); setPendingCompany(null); }
  };
  const cancelSwitch = () => setPendingCompany(null);

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

      <header className="noorix-topbar flex items-center justify-between gap-3 h-14 px-4 bg-[var(--noorix-topbar-bg)] border-b border-[var(--noorix-topbar-border)] shrink-0">

        {/* ── يمين: هامبرجر + شعار ── */}
        <div className="flex items-center gap-2.5 shrink-0">
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
          <span className="text-[15px] font-extrabold text-noorix-navy tracking-tight hidden sm:block">Noorix</span>
        </div>

        {/* ── وسط: مبدّل الشركة ── */}
        <div className="flex-1 flex justify-center min-w-0 px-2">
          {coName ? (
            <div className="relative">
              <Button
                ref={coDropBtnRef}
                variant="raw"
                size="auto"
                onClick={showCompanySwitcher ? () => { updateCoDropPos(); setCoDropOpen((v: any) => !v); } : undefined}
                className="flex items-center gap-2 px-3 h-9 rounded-lg transition-colors max-w-[260px]"
                style={{
                  background: coDropOpen ? 'var(--noorix-bg-muted)' : 'transparent',
                  border: '1px solid transparent',
                  cursor: showCompanySwitcher ? 'pointer' : 'default',
                  ...(showCompanySwitcher && { borderColor: coDropOpen ? 'var(--noorix-border)' : 'transparent' }),
                }}
                title={coName}
              >
                {/* أيقونة الشركة */}
                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 overflow-hidden text-[11px] font-extrabold text-white"
                  style={{
                    background: coLogo
                      ? 'transparent'
                      : 'linear-gradient(135deg,var(--noorix-navy-light),var(--noorix-navy))',
                  }}
                >
                  {coLogo
                    ? <img src={coLogo} alt={coName} className="w-full h-full object-cover" />
                    : coInitial}
                </div>

                <span className="text-[13px] font-semibold text-noorix-text truncate max-w-[180px]">
                  {coName}
                </span>

                {showCompanySwitcher && (
                  <svg
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    width="12" height="12"
                    className="shrink-0 text-noorix-muted transition-transform duration-150"
                    style={{ transform: coDropOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </Button>

              {/* قائمة الشركات */}
              {showCompanySwitcher && coDropOpen && createPortal(
                <div
                  ref={coDropMenuRef}
                  role="listbox"
                  aria-label={t('activeCompany')}
                  className="fixed bg-noorix-surface rounded border border-noorix-border overflow-y-auto"
                  style={{
                    zIndex: 9999,
                    top: coDropPos.top,
                    left: coDropPos.left,
                    width: coDropPos.width,
                    maxHeight: 280,
                    boxShadow: '0 8px 32px rgba(10,31,68,0.16)',
                  }}
                >
                  {companies.map((c: any) => {
                    const cName = lang === 'en' ? (c.nameEn || c.nameAr) : (c.nameAr || c.nameEn) || c.id;
                    const isActive = c.id === activeCompanyId;
                    const initial = cName?.[0] || '?';
                    return (
                      <Button
                        key={c.id}
                        variant="raw"
                        size="auto"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleCompanySelect(c.id)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-start border-b border-noorix-border last:border-b-0 transition-colors hover:bg-noorix-bg-muted"
                        style={{
                          background: isActive ? 'var(--noorix-blue-8)' : 'transparent',
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? 'var(--noorix-accent-blue)' : 'var(--noorix-text)',
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[11px] font-extrabold text-white overflow-hidden"
                          style={{
                            background: c.logoUrl
                              ? 'transparent'
                              : 'linear-gradient(135deg,var(--noorix-navy-light),var(--noorix-navy))',
                          }}
                        >
                          {c.logoUrl
                            ? <img src={c.logoUrl} alt={cName} className="w-full h-full object-cover" />
                            : initial}
                        </div>
                        <span className="truncate flex-1">{cName}</span>
                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path d="M2 7l3.5 3.5 6.5-7" stroke="var(--noorix-accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </Button>
                    );
                  })}
                </div>,
                document.body,
              )}
            </div>
          ) : null}
        </div>

        {/* ── يسار: قائمة المستخدم ── */}
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

      {/* نافذة تأكيد تبديل الشركة */}
      <Modal
        open={!!pendingCompany}
        onClose={cancelSwitch}
        closeOnBackdrop={false}
        size="sm"
        title={t('switchCompanyConfirmTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={cancelSwitch}>{t('cancel')}</Button>
            <Button variant="primary" onClick={confirmSwitch}>{t('switchCompanyConfirmBtn')}</Button>
          </>
        }
      >
        <p className="m-0 text-[14px] text-noorix-text leading-relaxed">
          {t('switchCompanyConfirmBody')} <strong>{pendingName}</strong>؟
        </p>
      </Modal>
    </>
  );
}

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../i18n/useTranslation';
import ChangePasswordModal from './ChangePasswordModal';
import { useToast } from '../context/ToastContext';
import { Button, FloatingPanel } from '../ui';
import { useIsNarrow768 } from '../hooks/useMediaQuery';

const ROLE_KEYS = {
  owner:       'roleOwner',
  super_admin: 'roleSuperAdmin',
  accountant:  'roleAccountant',
  cashier:     'roleCashier',
};

const ROLE_COLORS = {
  owner:       'var(--color-noorix-amber)',
  super_admin: 'var(--color-noorix-violet)',
  accountant:  'var(--color-noorix-sky)',
  cashier:     'var(--noorix-accent-green)',
};

/** أيقونة مستخدم (رأس + أكتاف) — بدون أحرف */
function UserSilhouetteIcon({ className = '' }: any) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

const MENU_WIDTH  = 240;
const VIEWPORT_GAP = 8;

export default function UserMenu({ user, onLogout, language, toggleLanguage }: any) {
  const { t, lang } = useTranslation();
  const showAppearance = typeof toggleLanguage === 'function';
  const [open, setOpen]                       = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { showToast } = useToast();
  const [pos, setPos]                         = useState<{ top: number; left: number; maxMenuH?: number }>({ top: 0, left: 0 });
  const btnRef  = useRef<any>(null);
  const menuRef = useRef<any>(null);

  const recalcPos = useCallback(() => {
    if (!btnRef.current) return;
    const r  = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = Math.max(0, vh - r.bottom - VIEWPORT_GAP * 2);
    const menuH      = Math.min(480, Math.max(200, spaceBelow));

    let left = r.right - MENU_WIDTH;
    if (left < VIEWPORT_GAP) left = VIEWPORT_GAP;
    if (left + MENU_WIDTH > vw - VIEWPORT_GAP) left = vw - MENU_WIDTH - VIEWPORT_GAP;

    const openAbove = spaceBelow < 200 && r.top > 200;
    const top = openAbove ? Math.max(VIEWPORT_GAP, r.top - menuH - 6) : r.bottom + 6;

    setPos({ top, left, maxMenuH: menuH });
  }, []);

  useEffect(() => { if (open) recalcPos(); }, [open, recalcPos]);

  useEffect(() => {
    if (!open) return;
    const close = (e: any) => {
      if (
        btnRef.current  && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close, { passive: true });
    window.addEventListener('resize', recalcPos);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      window.removeEventListener('resize', recalcPos);
    };
  }, [open, recalcPos]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: any) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const isMobileLayout = useIsNarrow768();

  const role = (user?.role || '').toLowerCase();
  const roleKey = role as keyof typeof ROLE_KEYS;
  const roleLabel = roleKey in ROLE_KEYS ? t(ROLE_KEYS[roleKey]) : role;
  const roleColor =
    (roleKey in ROLE_COLORS ? ROLE_COLORS[roleKey as keyof typeof ROLE_COLORS] : undefined) ||
    'var(--noorix-accent-green)';
  const displayName  = user?.nameAr || user?.nameEn || user?.email || t('userDefault');
  const email        = user?.email || '';
  /* ── القائمة المنسدلة ── */
  const dropdown = open && (
    <FloatingPanel
      ref={menuRef}
      role="menu"
      aria-label={t('userAccount')}
      className="um-dropdown"
      top={pos.top}
      left={pos.left}
      width={Math.min(MENU_WIDTH, (typeof window !== 'undefined' ? window.innerWidth : 320) - VIEWPORT_GAP * 2)}
      maxHeight={pos.maxMenuH || 480}
      zIndex="var(--nx-z-menu, 2500)"
      direction={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* رأس القائمة — معلومات المستخدم */}
      <div className="um-header">
        <div className="um-avatar-lg">
          <UserSilhouetteIcon className="um-avatar-icon um-avatar-icon--lg" />
        </div>
        <div className="um-header-info">
          <div className="um-name">{displayName}</div>
          <div className="um-email">{email}</div>
          <span className="um-role-badge">
            {roleLabel}
          </span>
        </div>
      </div>

      <div className="um-divider" />

      {/* مظهر النظام */}
      {showAppearance && (
        <>
          <div className="um-section">
            <Button
              variant="raw"
              className="um-item"
              onClick={toggleLanguage}
              icon={<span className="um-item-icon um-lang-icon">{language === 'ar' ? 'EN' : 'ع'}</span>}
              iconEnd={(
                <span className="um-lang-chip um-lang-chip--active">
                  {language === 'ar' ? 'EN' : 'AR'}
                </span>
              )}
            >
              <span className="um-item-label">
                {language === 'ar' ? 'English' : 'العربية'}
              </span>
            </Button>
          </div>
          <div className="um-divider" />
        </>
      )}

      {/* إجراءات الحساب */}
      <div className="um-section">
        <Button
          variant="raw"
          className="um-item um-item--disabled"
          disabled
          icon={<span className="um-item-icon">○</span>}
          iconEnd={<span className="um-badge">{t('comingSoon')}</span>}
        >
          <span className="um-item-label">{t('profile')}</span>
        </Button>
        <Button
          variant="raw"
          className="um-item"
          onClick={() => { setOpen(false); setShowChangePassword(true); }}
          icon={<span className="um-item-icon">⚿</span>}
        >
          <span className="um-item-label">{t('changePassword')}</span>
        </Button>
      </div>

      <div className="um-divider" />

      {/* تسجيل الخروج */}
      <div className="um-section um-section--last">
        <Button
          variant="raw"
          className="um-item um-item--danger"
          onClick={() => { setOpen(false); onLogout(); }}
          icon={<span className="um-item-icon">→</span>}
        >
          <span className="um-item-label">{t('logout')}</span>
        </Button>
      </div>
    </FloatingPanel>
  );

  return (
    <div className="um-wrapper">
      <Button
        ref={btnRef}
        variant="raw"
        type="button"
        className="um-trigger flex items-center gap-2 px-2.5 h-9 rounded-lg transition-colors hover:bg-noorix-bg-muted"
        onClick={() => setOpen((v: any) => !v)}
        title={displayName}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={displayName}
        style={{ ['--role-color' as string]: roleColor } as React.CSSProperties}
      >
        <span className="um-avatar">
          <UserSilhouetteIcon className="um-avatar-icon" />
        </span>
        {/* الاسم — يظهر من الشاشة المتوسطة فصاعداً */}
        <span className="hidden md:flex flex-col items-start leading-none gap-0.5 max-w-[120px]">
          <span className="text-[12px] font-semibold text-noorix-text truncate w-full">{displayName}</span>
          <span className="text-[10px] truncate w-full um-role-label">{roleLabel}</span>
        </span>
        <svg
          className={`um-chevron hidden sm:block${open ? ' um-chevron--open' : ''}`}
          width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
        >
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Button>

      {/* backdrop جوال */}
      {open && isMobileLayout && createPortal(
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="um-mobile-backdrop"
        />,
        document.body,
      )}

      {dropdown && createPortal(dropdown, document.body)}

      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onSuccess={(msg: any) => {
            setShowChangePassword(false);
            showToast(msg, 'success');
          }}
        />
      )}

    </div>
  );
}

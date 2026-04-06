import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../i18n/useTranslation';
import ChangePasswordModal from './ChangePasswordModal';
import Toast from './Toast';
import { Button } from '../ui';

const ROLE_KEYS = {
  owner: 'roleOwner',
  super_admin: 'roleSuperAdmin',
  accountant: 'roleAccountant',
  cashier: 'roleCashier',
};

const ROLE_COLORS = {
  owner: '#f59e0b',
  super_admin: '#a855f7',
  accountant: '#38bdf8',
  cashier: '#22c55e',
};

function getInitials(user) {
  const name = user?.nameAr || user?.nameEn || user?.email || '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  if (parts[0]?.length >= 2) return parts[0].slice(0, 2);
  return 'N';
}

const MENU_WIDTH = 232;
const VIEWPORT_GAP = 8;

export default function UserMenu({ user, onLogout, theme, toggleTheme, language, toggleLanguage }) {
  const { t, lang } = useTranslation();
  const showAppearance = typeof toggleTheme === 'function' && typeof toggleLanguage === 'function';
  const [open, setOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  /* --- تحديد موضع القائمة بذكاء داخل الشاشة --- */
  const recalcPos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = Math.max(0, vh - r.bottom - VIEWPORT_GAP * 2);
    const menuH = Math.min(480, Math.max(200, spaceBelow));

    // نُحاذي الحافة اليمنى للقائمة مع الحافة اليمنى للزر (طبيعي لـ RTL)
    let left = r.right - MENU_WIDTH;
    // ألا تخرج عن الحافة اليسرى
    if (left < VIEWPORT_GAP) left = VIEWPORT_GAP;
    // ألا تتجاوز الحافة اليمنى
    if (left + MENU_WIDTH > vw - VIEWPORT_GAP) left = vw - MENU_WIDTH - VIEWPORT_GAP;

    const openAbove = spaceBelow < 200 && r.top > 200;
    const top = openAbove
      ? Math.max(VIEWPORT_GAP, r.top - menuH - 6)
      : r.bottom + 6;

    setPos({ top, left, maxMenuH: menuH });
  }, []);

  useEffect(() => {
    if (open) recalcPos();
  }, [open, recalcPos]);

  /* --- إغلاق عند النقر/اللمس خارج القائمة --- */
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
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

  /* --- إغلاق عند الضغط على Escape --- */
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const role = (user?.role || '').toLowerCase();
  const roleLabel = ROLE_KEYS[role] ? t(ROLE_KEYS[role]) : role;
  const roleColor = ROLE_COLORS[role] || '#22c55e';
  const initials = getInitials(user);
  const displayName = user?.nameAr || user?.nameEn || user?.email || t('userDefault');
  const email = user?.email || '';
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const dropdown = open && (
    <div
      ref={menuRef}
      role="menu"
      aria-label={t('userAccount')}
      className="nx-bg-surface nx-text-primary nx-rounded-lg"
      style={{
        position: 'fixed',
        zIndex: 10050,
        top: pos.top,
        left: pos.left,
        right: 'auto',
        width: Math.min(MENU_WIDTH, (typeof window !== 'undefined' ? window.innerWidth : 320) - VIEWPORT_GAP * 2),
        maxHeight: pos.maxMenuH || 480,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        direction: lang === 'ar' ? 'rtl' : 'ltr',
        border: '1px solid var(--noorix-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
        animation: 'fadeSlideDown 0.15s ease',
      }}
    >
      {/* رأس القائمة */}
      <div style={S.dropdownHeader}>
        <div style={{ ...S.avatarLg, borderColor: roleColor }}>{initials}</div>
        <div className="nx-flex-1" style={{ minWidth: 0 }}>
          <div style={S.dropdownName}>{displayName}</div>
          <div style={S.dropdownEmail}>{email}</div>
          <span style={{ ...S.dropdownRoleBadge, background: roleColor + '22', color: roleColor, borderColor: roleColor + '44' }}>
            {roleLabel}
          </span>
        </div>
      </div>

      <div style={S.divider} />

      {showAppearance && (
        <>
          <div style={S.dropdownBody}>
            <Button variant="ghost" className="user-menu-item" style={S.menuItemAction} onClick={toggleTheme}>
              <span style={{ ...S.menuItemIcon, fontSize: 14, fontWeight: 700, color: 'var(--noorix-text-muted)' }}>{theme === 'light' ? '◑' : '○'}</span>
              <span className="nx-flex-1" style={{ textAlign: 'inherit' }}>
                {theme === 'light' ? t('darkMode') : t('lightMode')}
              </span>
            </Button>
            <Button variant="ghost" className="user-menu-item" style={S.menuItemAction} onClick={toggleLanguage}>
              <span style={{ ...S.menuItemIcon, fontSize: 11, fontWeight: 800, color: 'var(--noorix-text-muted)' }}>{language === 'ar' ? 'EN' : 'ع'}</span>
              <span className="nx-flex-1 nx-font-600 nx-text-sm" style={{ textAlign: 'inherit' }}>
                {language === 'ar' ? 'English' : 'العربية'}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 5,
                background: language === 'ar' ? '#1d4ed815' : '#16a34a15',
                color: language === 'ar' ? '#1d4ed8' : '#16a34a',
                border: `1px solid ${language === 'ar' ? '#1d4ed830' : '#16a34a30'}`,
                flexShrink: 0,
              }}>
                {language === 'ar' ? 'EN' : 'AR'}
              </span>
            </Button>
          </div>
          <div style={S.divider} />
        </>
      )}

      <div style={S.dropdownBody}>
        <Button variant="ghost" className="user-menu-item" style={S.menuItem} disabled>
          <span style={{ ...S.menuItemIcon, fontSize: 14, color: 'var(--noorix-text-muted)' }}>○</span>
          {t('profile')}
          <span style={S.menuItemBadge}>{t('comingSoon')}</span>
        </Button>
        <Button
          variant="ghost"
          className="user-menu-item"
          style={{ ...S.menuItem, cursor: 'pointer', color: 'var(--noorix-text)' }}
          onClick={() => { setOpen(false); setShowChangePassword(true); }}
        >
          <span style={{ ...S.menuItemIcon, fontSize: 13, color: 'var(--noorix-text-muted)' }}>⚿</span>
          {t('changePassword')}
        </Button>
      </div>

      <div style={S.divider} />

      <div style={{ padding: '5px 6px' }}>
        <Button
          variant="ghost"
          className="user-menu-item"
          onClick={() => { setOpen(false); onLogout(); }}
          style={S.logoutBtn}
        >
          <span style={{ ...S.menuItemIcon, fontSize: 13, color: 'var(--noorix-text-muted)' }}>→</span>
          {t('logout')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="user-menu-wrapper nx-ltr" style={{ position: 'relative', minWidth: 0 }}>
      {/* زر الأفاتار */}
      <Button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        style={S.trigger}
        title={displayName}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="user-menu-trigger nx-shell-icon-btn"
      >
        <div style={{ ...S.avatar, borderColor: roleColor }}>{initials}</div>
        <div style={S.triggerInfo} className="user-menu-trigger-info">
          <span style={S.triggerName}>{displayName}</span>
          <span style={{ ...S.roleBadge, background: roleColor + '22', color: roleColor }}>
            {roleLabel}
          </span>
        </div>
        <span style={{ ...S.chevron, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </Button>

      {/* backdrop شفاف للجوال لإغلاق القائمة بالضغط خارجها */}
      {open && isMobile && createPortal(
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10049,
            background: 'transparent',
            WebkitTapHighlightColor: 'transparent',
          }}
        />,
        document.body,
      )}

      {dropdown && createPortal(dropdown, document.body)}

      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onSuccess={(msg) => {
            setShowChangePassword(false);
            setToast({ visible: true, message: msg, type: 'success' });
          }}
        />
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((p) => ({ ...p, visible: false }))}
      />
    </div>
  );
}

const S = {
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px 4px 4px',
    minWidth: 0,
    maxWidth: 180,
    minHeight: 40,
    borderRadius: 999,
    border: '1px solid var(--noorix-border)',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--noorix-text)',
    transition: 'background 0.2s',
    fontFamily: 'inherit',
    touchAction: 'manipulation',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    border: '2px solid rgba(255,255,255,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
    color: '#fff',
    flexShrink: 0,
  },
  triggerInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    maxWidth: 100,
    minWidth: 0,
    overflow: 'hidden',
  },
  triggerName: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--noorix-text)',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  roleBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: 999,
    lineHeight: 1.5,
  },
  chevron: {
    fontSize: 12,
    color: 'var(--noorix-text-muted)',
    transition: 'transform 0.2s',
    flexShrink: 0,
  },
  dropdownHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 12px 8px',
  },
  avatarLg: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    border: '2px solid rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 800,
    color: '#fff',
    flexShrink: 0,
  },
  dropdownName: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--noorix-text)',
    lineHeight: 1.3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dropdownEmail: {
    fontSize: 11,
    color: 'var(--noorix-text-muted)',
    marginBottom: 3,
    direction: 'ltr',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dropdownRoleBadge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: 999,
    border: '1px solid',
  },
  divider: {
    height: 1,
    background: 'var(--noorix-border)',
    margin: '0 10px',
  },
  dropdownBody: {
    padding: '4px 6px',
    display: 'grid',
    gap: 1,
  },
  menuItemAction: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 8px',
    borderRadius: 7,
    border: 'none',
    background: 'none',
    color: 'var(--noorix-text)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'inherit',
    width: '100%',
    transition: 'background 0.15s',
    minHeight: 40,
    touchAction: 'manipulation',
  },
  langChip: {
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 5,
    background: 'var(--noorix-bg-muted)',
    color: 'var(--noorix-text-muted)',
    flexShrink: 0,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 8px',
    borderRadius: 7,
    border: 'none',
    background: 'none',
    color: 'var(--noorix-text-muted)',
    fontSize: 13,
    cursor: 'not-allowed',
    fontFamily: 'inherit',
    textAlign: 'inherit',
    width: '100%',
    minHeight: 40,
  },
  menuItemIcon: {
    fontSize: 15,
    flexShrink: 0,
    width: 18,
    textAlign: 'center',
  },
  menuItemBadge: {
    marginInlineStart: 'auto',
    fontSize: 10,
    padding: '1px 5px',
    borderRadius: 999,
    background: 'var(--noorix-bg-muted)',
    color: 'var(--noorix-text-muted)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 8px',
    borderRadius: 7,
    border: 'none',
    background: 'rgba(239,68,68,0.07)',
    color: '#ef4444',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'inherit',
    transition: 'background 0.15s',
    minHeight: 40,
    touchAction: 'manipulation',
  },
};

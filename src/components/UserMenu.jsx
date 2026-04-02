import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../i18n/useTranslation';
import ChangePasswordModal from './ChangePasswordModal';
import Toast from './Toast';

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

const MENU_WIDTH = 280;
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

    // maxHeight لا يكون سالباً أبداً — حد أدنى 200px
    const spaceBelow = Math.max(0, vh - r.bottom - VIEWPORT_GAP * 2);
    const menuH = Math.min(520, Math.max(200, spaceBelow));

    // نحاول محاذاة الحافة اليسرى للقائمة مع الحافة اليسرى للزر
    let left = r.left;
    // إذا القائمة ستتجاوز الحافة اليمنى → نزيحها يساراً
    if (left + MENU_WIDTH > vw - VIEWPORT_GAP) left = vw - MENU_WIDTH - VIEWPORT_GAP;
    // ألا تخرج عن الحافة اليسرى أبداً
    left = Math.max(VIEWPORT_GAP, left);

    // إذا لم يكن هناك مساحة كافية أسفل الزر → افتح فوقه
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
      role="dialog"
      aria-label={t('userAccount')}
      style={{
        position: 'fixed',
        zIndex: 10050,
        top: pos.top,
        left: pos.left,
        right: 'auto',
        width: Math.min(MENU_WIDTH, (typeof window !== 'undefined' ? window.innerWidth : 400) - VIEWPORT_GAP * 2),
        maxHeight: pos.maxMenuH || 480,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        direction: lang === 'ar' ? 'rtl' : 'ltr',
        background: 'var(--noorix-bg-surface)',
        color: 'var(--noorix-text)',
        border: '1px solid var(--noorix-border)',
        borderRadius: 14,
        boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
        animation: 'fadeSlideDown 0.15s ease',
      }}
    >
      {/* رأس القائمة */}
      <div style={S.dropdownHeader}>
        <div style={{ ...S.avatarLg, borderColor: roleColor }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
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
          <div style={{ ...S.dropdownBody, paddingTop: 4 }}>
            <button type="button" style={S.menuItemAction} onClick={toggleTheme}>
              <span style={S.menuItemIcon}>{theme === 'light' ? '🌙' : '☀️'}</span>
              <span style={{ flex: 1, textAlign: 'inherit' }}>
                {theme === 'light' ? t('darkMode') : t('lightMode')}
              </span>
            </button>
            <button type="button" style={S.menuItemAction} onClick={toggleLanguage}>
              <span style={S.menuItemIcon}>🌐</span>
              <span style={{ flex: 1, textAlign: 'inherit' }}>
                {language === 'ar' ? t('switchToEnglish') : t('switchToArabic')}
              </span>
              <span style={S.langChip}>{language === 'ar' ? 'AR' : 'EN'}</span>
            </button>
          </div>
          <div style={S.divider} />
        </>
      )}

      <div style={S.dropdownBody}>
        <button type="button" style={S.menuItem} disabled>
          <span style={S.menuItemIcon}>👤</span>
          {t('profile')}
          <span style={S.menuItemBadge}>{t('comingSoon')}</span>
        </button>
        <button
          type="button"
          style={{ ...S.menuItem, cursor: 'pointer', color: 'var(--noorix-text)' }}
          onClick={() => { setOpen(false); setShowChangePassword(true); }}
        >
          <span style={S.menuItemIcon}>🔑</span>
          {t('changePassword')}
        </button>
      </div>

      <div style={S.divider} />

      <div style={{ padding: '6px 8px' }}>
        <button
          type="button"
          onClick={() => { setOpen(false); onLogout(); }}
          style={S.logoutBtn}
        >
          <span style={S.menuItemIcon}>🚪</span>
          {t('logout')}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', direction: 'ltr', minWidth: 0 }} className="user-menu-wrapper">
      {/* زر الأفاتار */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={S.trigger}
        title={displayName}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="user-menu-trigger"
      >
        <div style={{ ...S.avatar, borderColor: roleColor }}>{initials}</div>
        <div style={S.triggerInfo} className="user-menu-trigger-info">
          <span style={S.triggerName}>{displayName}</span>
          <span style={{ ...S.roleBadge, background: roleColor + '22', color: roleColor }}>
            {roleLabel}
          </span>
        </div>
        <span style={{ ...S.chevron, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>

      {/* backdrop شفاف للجوال لإغلاق القائمة بالضغط خارجها */}
      {open && isMobile && createPortal(
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10049,
            background: 'rgba(0,0,0,0.25)',
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
    gap: 12,
    padding: '14px 14px 10px',
  },
  avatarLg: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    border: '2px solid rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 800,
    color: '#fff',
    flexShrink: 0,
  },
  dropdownName: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--noorix-text)',
    lineHeight: 1.3,
  },
  dropdownEmail: {
    fontSize: 12,
    color: 'var(--noorix-text-muted)',
    marginBottom: 4,
    direction: 'ltr',
    textAlign: 'left',
    wordBreak: 'break-all',
  },
  dropdownRoleBadge: {
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 999,
    border: '1px solid',
  },
  divider: {
    height: 1,
    background: 'var(--noorix-border)',
    margin: '0 14px',
  },
  dropdownBody: {
    padding: '6px 8px',
    display: 'grid',
    gap: 2,
  },
  menuItemAction: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 10px',
    borderRadius: 8,
    border: 'none',
    background: 'none',
    color: 'var(--noorix-text)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'inherit',
    width: '100%',
    transition: 'background 0.15s',
    minHeight: 44,
    touchAction: 'manipulation',
  },
  langChip: {
    fontSize: 11,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--noorix-bg-muted)',
    color: 'var(--noorix-text-muted)',
    flexShrink: 0,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 10px',
    borderRadius: 8,
    border: 'none',
    background: 'none',
    color: 'var(--noorix-text-muted)',
    fontSize: 13,
    cursor: 'not-allowed',
    fontFamily: 'inherit',
    textAlign: 'inherit',
    width: '100%',
    minHeight: 44,
  },
  menuItemIcon: {
    fontSize: 16,
    flexShrink: 0,
  },
  menuItemBadge: {
    marginRight: 'auto',
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 999,
    background: 'var(--noorix-bg-muted)',
    color: 'var(--noorix-text-muted)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 10px',
    borderRadius: 8,
    border: 'none',
    background: 'rgba(239,68,68,0.06)',
    color: '#ef4444',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'inherit',
    transition: 'background 0.15s',
    minHeight: 44,
    touchAction: 'manipulation',
  },
};

import React, { useState, useRef, useEffect } from 'react';
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

export default function UserMenu({ user, onLogout }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const role = (user?.role || '').toLowerCase();
  const roleLabel = ROLE_KEYS[role] ? t(ROLE_KEYS[role]) : role;
  const roleColor = ROLE_COLORS[role] || '#22c55e';
  const initials = getInitials(user);
  const displayName = user?.nameAr || user?.nameEn || user?.email || t('userDefault');
  const email = user?.email || '';

  const dropdownStyle = {
    ...styles.dropdown,
    position: 'fixed',
    top: pos.top,
    right: pos.right,
    left: 'auto',
    direction: 'ltr',
  };

  return (
    <div style={{ position: 'relative', direction: 'ltr', minWidth: 0 }} className="user-menu-wrapper">
      {/* زر الأفاتار */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={styles.trigger}
        title={t('userAccount')}
        aria-expanded={open}
        aria-haspopup="true"
        className="user-menu-trigger"
      >
        <div style={{ ...styles.avatar, borderColor: roleColor }}>
          {initials}
        </div>
        <div style={styles.triggerInfo} className="user-menu-trigger-info">
          <span style={styles.triggerName}>{displayName}</span>
          <span style={{ ...styles.roleBadge, background: roleColor + '22', color: roleColor }}>
            {roleLabel}
          </span>
        </div>
        <span style={{ ...styles.chevron, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>

      {/* القائمة المنسدلة — Portal لتجنب القص */}
      {open && createPortal(
        <div ref={menuRef} style={dropdownStyle}>
          {/* رأس القائمة */}
          <div style={styles.dropdownHeader}>
            <div style={{ ...styles.avatarLg, borderColor: roleColor }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.dropdownName}>{displayName}</div>
              <div style={styles.dropdownEmail}>{email}</div>
              <span style={{ ...styles.dropdownRoleBadge, background: roleColor + '22', color: roleColor, borderColor: roleColor + '44' }}>
                {roleLabel}
              </span>
            </div>
          </div>

          <div style={styles.divider} />

          {/* عناصر القائمة */}
          <div style={styles.dropdownBody}>
            <button type="button" style={styles.menuItem} disabled>
              <span style={styles.menuItemIcon}>👤</span>
              {t('profile')}
              <span style={styles.menuItemBadge}>{t('comingSoon')}</span>
            </button>
            <button
              type="button"
              style={{ ...styles.menuItem, cursor: 'pointer', color: 'var(--noorix-text)' }}
              onClick={() => { setOpen(false); setShowChangePassword(true); }}
            >
              <span style={styles.menuItemIcon}>🔑</span>
              {t('changePassword')}
            </button>
          </div>

          <div style={styles.divider} />

          {/* تسجيل الخروج */}
          <div style={{ padding: '6px 8px' }}>
            <button
              type="button"
              onClick={() => { setOpen(false); onLogout(); }}
              style={styles.logoutBtn}
            >
              <span style={styles.menuItemIcon}>🚪</span>
              {t('logout')}
            </button>
          </div>
        </div>
      , document.body)}

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

const styles = {
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px 4px 4px',
    minWidth: 0,
    maxWidth: 180,
    borderRadius: 999,
    border: '1px solid var(--noorix-border)',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--noorix-text)',
    transition: 'background 0.2s',
    fontFamily: 'inherit',
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
    fontSize: 12,
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
  dropdown: {
    minWidth: 240,
    maxWidth: 320,
    background: 'var(--noorix-bg-surface)',
    color: 'var(--noorix-text)',
    border: '1px solid var(--noorix-border)',
    borderRadius: 14,
    boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
    zIndex: 9999,
    overflow: 'hidden',
    animation: 'fadeSlideDown 0.15s ease',
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
    textAlign: 'right',
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
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 10px',
    borderRadius: 8,
    border: 'none',
    background: 'none',
    color: 'var(--noorix-text-muted)',
    fontSize: 13,
    cursor: 'not-allowed',
    fontFamily: 'inherit',
    textAlign: 'right',
    width: '100%',
  },
  menuItemIcon: {
    fontSize: 15,
    flexShrink: 0,
  },
  menuItemBadge: {
    marginRight: 'auto',
    fontSize: 12,
    padding: '2px 6px',
    borderRadius: 999,
    background: 'var(--noorix-bg-muted)',
    color: 'var(--noorix-text-muted)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 10px',
    borderRadius: 8,
    border: 'none',
    background: 'rgba(239,68,68,0.06)',
    color: '#ef4444',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'right',
    transition: 'background 0.15s',
  },
};

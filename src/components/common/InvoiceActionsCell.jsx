/**
 * InvoiceActionsCell — قائمة إجراءات منسدلة (Kebab) للفاتورة
 * عرض، تعديل، حذف، طباعة — حسب الصلاحيات
 * يستخدم Portal لتجنب القص بواسطة overflow الجدول
 */
import React, { memo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { hasPermission } from '../../constants/permissions';
import { useTranslation } from '../../i18n/useTranslation';

const KebabIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <circle cx="8" cy="4" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="8" cy="12" r="1.5" />
  </svg>
);

const menuItemStyle = {
  display: 'block', width: '100%', padding: '8px 12px',
  fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 6,
  background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
  whiteSpace: 'nowrap', textAlign: 'right',
};

export const InvoiceActionsCell = memo(function InvoiceActionsCell({
  row, userRole, userPermissions, companyId, onView, onPrint, onEdit, onDelete,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, right: 0, openUpward: false });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const MENU_WIDTH = 176;
  const MENU_MAX_HEIGHT = 280;
  const VIEWPORT_GAP = 10;

  const canPrint = hasPermission(userRole, 'INVOICES_READ', userPermissions);
  const canEdit  = hasPermission(userRole, 'INVOICES_WRITE', userPermissions);
  const canDel   = (userRole || '').toLowerCase() === 'owner';
  const canView  = !!onView && canPrint;
  const showEdit = canEdit && row.status === 'active' && row.kind !== 'sale';
  const showDel  = canDel && !!onDelete;
  const showAny  = canPrint || canEdit || canDel || canView;

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const itemCount = [canView, canPrint, showEdit, showDel].filter(Boolean).length;
      const estimatedHeight = Math.min(MENU_MAX_HEIGHT, (Math.max(1, itemCount) * 42) + 12);
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      const openUpward = spaceBelow < estimatedHeight + VIEWPORT_GAP && spaceAbove > spaceBelow;
      const top = openUpward
        ? Math.max(VIEWPORT_GAP, r.top - estimatedHeight - 4)
        : Math.min(window.innerHeight - estimatedHeight - VIEWPORT_GAP, r.bottom + 4);
      const safeLeft = Math.min(
        Math.max(VIEWPORT_GAP, r.left),
        Math.max(VIEWPORT_GAP, window.innerWidth - MENU_WIDTH - VIEWPORT_GAP),
      );
      setPos({ top, left: safeLeft, right: safeLeft + r.width, openUpward });
    }
  }, [open, canView, canPrint, showEdit, showDel]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!showAny) return <span style={{ color: 'var(--noorix-text-muted)', fontSize: 12 }}>—</span>;

  const close = () => setOpen(false);
  const run = (fn) => { close(); fn?.(row); };

  const isRtl = document.documentElement.dir === 'rtl';

  const menuContent = open && (
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      style={{
        position: 'fixed',
        zIndex: 9999,
        top: pos.top,
        ...(isRtl ? { right: Math.max(VIEWPORT_GAP, window.innerWidth - pos.left - MENU_WIDTH) } : { left: pos.left }),
        minWidth: 150,
        width: MENU_WIDTH,
        maxHeight: MENU_MAX_HEIGHT,
        overflowY: 'auto',
        padding: 6,
        borderRadius: 10,
        background: 'var(--noorix-bg-surface)',
        color: 'var(--noorix-text)',
        border: '1px solid var(--noorix-border)',
        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.18)',
      }}
    >
      {canView && (
        <button type="button" role="menuitem" onClick={() => run(onView)} style={{ ...menuItemStyle, color: 'var(--noorix-text)' }}>
          {t('view')}
        </button>
      )}
      {canPrint && (
        <button type="button" role="menuitem" onClick={() => run(onPrint)} style={{ ...menuItemStyle, color: 'var(--noorix-text)' }}>
          {t('print')}
        </button>
      )}
      {showEdit && (
        <button type="button" role="menuitem" onClick={() => run(onEdit)} style={{ ...menuItemStyle, color: '#16a34a' }}>
          {t('edit')}
        </button>
      )}
      {showDel && (
        <button type="button" role="menuitem" onClick={() => run(onDelete)} style={{ ...menuItemStyle, color: '#dc2626' }}>
          {t('delete')}
        </button>
      )}
    </div>
  );

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        ref={btnRef}
        type="button"
        aria-label={t('actions')}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((p) => !p)}
        style={{
          width: 36, height: 32, minWidth: 36, minHeight: 32, borderRadius: 6, border: '1px solid var(--noorix-border)',
          background: open ? 'var(--noorix-bg-page)' : 'var(--noorix-bg-surface)',
          color: 'var(--noorix-text-muted)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 120ms, color 120ms',
        }}
      >
        <KebabIcon />
      </button>
      {menuContent && createPortal(menuContent, document.body)}
    </div>
  );
});

export default InvoiceActionsCell;

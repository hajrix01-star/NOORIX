/**
 * InvoiceActionsCell — قائمة إجراءات منسدلة (Kebab) للفاتورة
 * عرض، تعديل، حذف، طباعة — حسب الصلاحيات
 * يستخدم Portal لتجنب القص بواسطة overflow الجدول
 */
import React, { memo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { hasPermission } from '../../constants/permissions';
import { useTranslation } from '../../i18n/useTranslation';
import { Button } from '../../ui';

const KebabIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <circle cx="8" cy="4" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="8" cy="12" r="1.5" />
  </svg>
);


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

  if (!showAny) return <span className="nx-cell-muted">—</span>;

  const close = () => setOpen(false);
  const run = (fn) => { close(); fn?.(row); };

  const isRtl = document.documentElement.dir === 'rtl';

  const menuContent = open && (
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      className="nx-actions-menu"
      style={{ top: pos.top, maxHeight: MENU_MAX_HEIGHT, ...(isRtl ? { right: Math.max(VIEWPORT_GAP, window.innerWidth - pos.left - MENU_WIDTH) } : { left: pos.left }) }}
    >
      {canView && (
        <Button role="menuitem" onClick={() => run(onView)} className="nx-actions-menu-item" style={{ color: 'var(--noorix-text)' }}>
          {t('view')}
        </Button>
      )}
      {canPrint && (
        <Button role="menuitem" onClick={() => run(onPrint)} className="nx-actions-menu-item" style={{ color: 'var(--noorix-text)' }}>
          {t('print')}
        </Button>
      )}
      {showEdit && (
        <Button role="menuitem" onClick={() => run(onEdit)} className="nx-actions-menu-item" style={{ color: 'var(--noorix-accent-green)' }}>
          {t('edit')}
        </Button>
      )}
      {showDel && (
        <Button role="menuitem" onClick={() => run(onDelete)} className="nx-actions-menu-item" style={{ color: 'var(--noorix-accent-red)' }}>
          {t('delete')}
        </Button>
      )}
    </div>
  );

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <Button
        ref={btnRef}
        aria-label={t('actions')}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((p) => !p)}
        className={`nx-actions-kebab${open ? ' nx-actions-kebab--open' : ''}`}
      >
        <KebabIcon />
      </Button>
      {menuContent && createPortal(menuContent, document.body)}
    </div>
  );
});

export default InvoiceActionsCell;

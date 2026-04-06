/**
 * SalesActionsCell — قائمة إجراءات احترافية لملخص المبيعات
 */
import React, { memo, useEffect, useRef, useState } from 'react';
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


export const SalesActionsCell = memo(function SalesActionsCell({
  summary, userRole, userPermissions, onPrint, onEdit, onDelete,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const MENU_WIDTH = 176;
  const MENU_MAX_HEIGHT = 220;
  const VIEWPORT_GAP = 10;
  const canPrint = hasPermission(userRole, 'SALES_READ', userPermissions);
  const canEdit  = hasPermission(userRole, 'SALES_WRITE', userPermissions) || hasPermission(userRole, 'SALES_ACTIONS', userPermissions);
  const canDel   = (userRole || '').toLowerCase() === 'owner';
  const showAny  = canPrint || canEdit || canDel;

  if (!showAny) return <span className="nx-cell-muted">—</span>;

  const items = [];
  if (canPrint) items.push({ key: 'print', label: t('printWhatsApp'), fn: onPrint, color: '#2563eb' });
  if (canEdit && summary.status === 'active') items.push({ key: 'edit', label: t('edit'), fn: onEdit, color: '#16a34a' });
  if (canDel && onDelete) items.push({ key: 'delete', label: t('delete'), fn: onDelete, color: '#dc2626' });

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const estimatedHeight = Math.min(MENU_MAX_HEIGHT, (items.length * 42) + 12);
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
      setPos({ top, left: safeLeft });
    }
  }, [open, items.length]);

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

  const isRtl = document.documentElement.dir === 'rtl';
  const run = (fn) => {
    setOpen(false);
    fn?.(summary);
  };

  const menuContent = open && (
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      className="nx-actions-menu"
      style={{ top: pos.top, ...(isRtl ? { right: Math.max(VIEWPORT_GAP, window.innerWidth - pos.left - MENU_WIDTH) } : { left: pos.left }) }}
    >
      {items.map((it) => (
        <Button
          key={it.key}
          role="menuitem"
          onClick={() => run(it.fn)}
          className="nx-actions-menu-item"
          style={{ color: it.color }}
        >
          {it.label}
        </Button>
      ))}
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

export default SalesActionsCell;

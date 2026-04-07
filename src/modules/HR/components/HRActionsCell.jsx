/**
 * HRActionsCell — قائمة إجراءات منسدلة (Kebab) لصفوف HR
 * عرض، تعديل، اعتماد، صرف — حسب نوع الجدول والسياق
 */
import React, { memo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button } from '../../../ui';

const KebabIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <circle cx="8" cy="4" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="8" cy="12" r="1.5" />
  </svg>
);


export const HRActionsCell = memo(function HRActionsCell({
  row,
  type, // 'payroll' | 'leave' | 'advance' | 'residency'
  onView,
  onEdit,
  onApprove,
  onReject,
  onPay,
  onAdvance,
  onSettle,
  onTerminate,
  onArchive,
  onRestore,
  onDelete,
  onPermanentDelete,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, right: 0, openUpward: false });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const MENU_WIDTH = 176;
  const MENU_MAX_HEIGHT = 280;
  const VIEWPORT_GAP = 10;

  const items = [];
  if (onView) items.push({ key: 'view', label: t('view'), fn: onView, color: 'var(--noorix-text)' });
  if (onEdit) items.push({ key: 'edit', label: t('edit'), fn: onEdit, color: 'var(--noorix-accent-green)' });
  if (onApprove) items.push({ key: 'approve', label: t('statusApproved'), fn: onApprove, color: 'var(--noorix-accent-green)' });
  if (onReject) items.push({ key: 'reject', label: t('statusRejected'), fn: onReject, color: 'var(--noorix-accent-red)' });
  if (onPay) items.push({ key: 'pay', label: t('payrollPay') || 'صرف المسيرة', fn: onPay, color: 'var(--noorix-accent-blue)' });
  if (onAdvance) items.push({ key: 'advance', label: t('quickAdvance') || 'صرف سلفة', fn: onAdvance, color: 'var(--color-noorix-amber)' });
  if (onSettle) items.push({ key: 'settle', label: t('settleAdvance') || 'تسديد السلفة', fn: onSettle, color: 'var(--noorix-accent-amber)' });
  if (onTerminate) items.push({ key: 'terminate', label: t('terminateEmployee'), fn: onTerminate, color: 'var(--noorix-accent-red)' });
  if (onArchive) items.push({ key: 'archive', label: t('archiveEmployee'), fn: onArchive, color: 'var(--noorix-text-muted)' });
  if (onRestore) items.push({ key: 'restore', label: t('restoreEmployee'), fn: onRestore, color: 'var(--noorix-accent-green)' });
  if (onDelete) items.push({ key: 'delete', label: t('delete'), fn: onDelete, color: 'var(--noorix-accent-red)' });
  if (onPermanentDelete) items.push({ key: 'permdelete', label: t('deleteEmployeePermanent'), fn: onPermanentDelete, color: '#7f1d1d' });

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
      setPos({ top, left: safeLeft, right: safeLeft + r.width, openUpward });
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

  if (items.length === 0) return <span style={{ color: 'var(--noorix-text-muted)', fontSize: 12 }}>—</span>;

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

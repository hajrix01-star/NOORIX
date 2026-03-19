/**
 * HRActionsCell — قائمة إجراءات منسدلة (Kebab) لصفوف HR
 * عرض، تعديل، اعتماد، صرف — حسب نوع الجدول والسياق
 */
import React, { memo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n/useTranslation';

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
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, right: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const items = [];
  if (onView) items.push({ key: 'view', label: t('view'), fn: onView, color: 'var(--noorix-text)' });
  if (onEdit) items.push({ key: 'edit', label: t('edit'), fn: onEdit, color: '#16a34a' });
  if (onApprove) items.push({ key: 'approve', label: t('statusApproved'), fn: onApprove, color: '#16a34a' });
  if (onReject) items.push({ key: 'reject', label: t('statusRejected'), fn: onReject, color: '#ef4444' });
  if (onPay) items.push({ key: 'pay', label: t('payrollPay') || 'صرف المسيرة', fn: onPay, color: '#2563eb' });
  if (onAdvance) items.push({ key: 'advance', label: t('quickAdvance') || 'صرف سلفة', fn: onAdvance, color: '#f59e0b' });
  if (onSettle) items.push({ key: 'settle', label: t('settleAdvance') || 'تسديد السلفة', fn: onSettle, color: '#b45309' });
  if (onTerminate) items.push({ key: 'terminate', label: t('terminateEmployee'), fn: onTerminate, color: '#ef4444' });
  if (onArchive) items.push({ key: 'archive', label: t('archiveEmployee'), fn: onArchive, color: '#64748b' });
  if (onRestore) items.push({ key: 'restore', label: t('restoreEmployee'), fn: onRestore, color: '#16a34a' });
  if (onDelete) items.push({ key: 'delete', label: t('delete'), fn: onDelete, color: '#dc2626' });

  useEffect(() => {
    if (open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, right: r.right });
    }
  }, [open]);

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
      style={{
        position: 'fixed',
        zIndex: 9999,
        top: pos.top,
        ...(isRtl ? { right: window.innerWidth - pos.right } : { left: pos.left }),
        minWidth: 150,
        maxHeight: 280,
        overflowY: 'auto',
        padding: 6,
        borderRadius: 8,
        background: 'var(--noorix-bg-surface)',
        color: 'var(--noorix-text)',
        border: '1px solid var(--noorix-border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      }}
    >
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="menuitem"
          onClick={() => run(it.fn)}
          style={{ ...menuItemStyle, color: it.color }}
        >
          {it.label}
        </button>
      ))}
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

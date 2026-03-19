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
  const [pos, setPos] = useState({ top: 0, left: 0, right: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const canPrint = hasPermission(userRole, 'INVOICES_READ', userPermissions);
  const canEdit  = hasPermission(userRole, 'INVOICES_WRITE', userPermissions);
  const canDel   = hasPermission(userRole, 'INVOICES_DELETE', userPermissions);
  const canView  = !!onView && canPrint;
  const showEdit = canEdit && row.status === 'active' && row.kind !== 'sale';
  const showDel  = canDel && row.status === 'active';
  const showAny  = canPrint || canEdit || canDel || canView;

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
          {t('cancelTitle')}
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

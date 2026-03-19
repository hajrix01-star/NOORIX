/**
 * SalesActionsCell — أزرار إجراءات ملخص المبيعات (طباعة، تعديل، إلغاء)
 * يعرض حسب الصلاحيات
 */
import React, { memo } from 'react';
import { hasPermission } from '../../constants/permissions';
import { useTranslation } from '../../i18n/useTranslation';

const BTN = {
  base: {
    width: 28, height: 28, borderRadius: 6, border: '1px solid var(--noorix-border)',
    background: 'var(--noorix-bg-surface)', cursor: 'pointer', fontSize: 12,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 120ms, border-color 120ms',
  },
  print: { color: '#2563eb' },
  edit:   { color: '#16a34a' },
  delete: { color: '#dc2626', borderColor: '#fecaca', background: 'rgba(239,68,68,0.06)' },
};

export const SalesActionsCell = memo(function SalesActionsCell({
  summary, userRole, onPrint, onEdit, onDelete,
}) {
  const { t } = useTranslation();
  const canPrint = hasPermission(userRole, 'SALES_READ');
  const canEdit  = hasPermission(userRole, 'SALES_WRITE') || hasPermission(userRole, 'SALES_ACTIONS');
  const canDel   = hasPermission(userRole, 'SALES_DELETE') || hasPermission(userRole, 'SALES_ACTIONS');
  const showAny  = canPrint || canEdit || canDel;

  if (!showAny) return <span style={{ color: 'var(--noorix-text-muted)', fontSize: 12 }}>—</span>;

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-start' }}>
      {canPrint && (
        <button
          type="button"
          title={t('printWhatsApp')}
          onClick={() => onPrint?.(summary)}
          style={{ ...BTN.base, ...BTN.print }}
        >
          🖨
        </button>
      )}
      {canEdit && summary.status === 'active' && (
        <button
          type="button"
          title={t('edit')}
          onClick={() => onEdit?.(summary)}
          style={{ ...BTN.base, ...BTN.edit }}
        >
          ✎
        </button>
      )}
      {canDel && summary.status === 'active' && (
        <button
          type="button"
          title={t('cancelTitle')}
          onClick={() => onDelete?.(summary)}
          style={{ ...BTN.base, ...BTN.delete }}
        >
          ×
        </button>
      )}
    </div>
  );
});

export default SalesActionsCell;

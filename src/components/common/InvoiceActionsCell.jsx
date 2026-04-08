/**
 * InvoiceActionsCell — قائمة إجراءات منسدلة (Kebab) للفاتورة
 */
import React, { memo, useMemo } from 'react';
import { hasPermission } from '../../constants/permissions';
import { useTranslation } from '../../i18n/useTranslation';
import { KebabMenu } from '../../ui';

export const InvoiceActionsCell = memo(function InvoiceActionsCell({
  row, userRole, userPermissions, companyId: _companyId, onView, onPrint, onEdit, onDelete,
}) {
  const { t } = useTranslation();

  const canPrint = hasPermission(userRole, 'INVOICES_READ', userPermissions);
  const canEdit  = hasPermission(userRole, 'INVOICES_WRITE', userPermissions);
  const canDel   = (userRole || '').toLowerCase() === 'owner';
  const canView  = !!onView && canPrint;
  const showEdit = canEdit && row.status === 'active' && row.kind !== 'sale';
  const showDel  = canDel && !!onDelete;
  const showAny  = canPrint || canEdit || canDel || canView;

  const items = useMemo(() => [
    {
      key: 'view',
      label: t('view'),
      hidden: !canView,
      style: { color: 'var(--noorix-text)' },
      onClick: () => onView?.(row),
    },
    {
      key: 'print',
      label: t('print'),
      hidden: !canPrint,
      style: { color: 'var(--noorix-text)' },
      onClick: () => onPrint?.(row),
    },
    {
      key: 'edit',
      label: t('edit'),
      hidden: !showEdit,
      style: { color: 'var(--noorix-accent-green)' },
      onClick: () => onEdit?.(row),
    },
    {
      key: 'delete',
      label: t('delete'),
      hidden: !showDel,
      style: { color: 'var(--noorix-accent-red)' },
      onClick: () => onDelete?.(row),
    },
  ], [canView, canPrint, showEdit, showDel, t, row, onView, onPrint, onEdit, onDelete]);

  if (!showAny) return <span className="nx-cell-muted">—</span>;

  return (
    <KebabMenu
      ariaLabel={t('actions')}
      items={items}
      menuMaxHeight={280}
    />
  );
});

export default InvoiceActionsCell;

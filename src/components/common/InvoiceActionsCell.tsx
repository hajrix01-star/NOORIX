/**
 * InvoiceActionsCell — قائمة إجراءات منسدلة (Kebab) للفاتورة
 */
import React, { memo, useMemo } from 'react';
import { hasPermission } from '../../constants/permissions';
import { useTranslation } from '../../i18n/useTranslation';
import { KebabMenu } from '../../ui';

export type InvoiceActionRow = {
  status?: string | null;
  kind?: string | null;
};

export type InvoiceActionsCellProps<TRow extends InvoiceActionRow = InvoiceActionRow> = {
  row: TRow;
  userRole?: string | null;
  userPermissions?: readonly string[] | null;
  companyId?: string;
  onView?: (row: TRow) => void;
  onPrint?: (row: TRow) => void;
  onEdit?: (row: TRow) => void;
  onDelete?: (row: TRow) => void;
};

export const InvoiceActionsCell = memo(function InvoiceActionsCell(props: InvoiceActionsCellProps) {
  const { row, userRole, userPermissions, onView, onPrint, onEdit, onDelete } = props;
  const { t } = useTranslation();

  const canPrint = hasPermission(userRole, 'INVOICES_READ', userPermissions);
  const isOwner    = (userRole || '').toLowerCase() === 'owner';
  const canDel   = isOwner;
  const canView  = !!onView && canPrint;
  const showEdit = isOwner && row.status === 'active' && row.kind !== 'sale';
  const showDel  = canDel && !!onDelete;
  const showAny  = canView || canPrint || showEdit || showDel;

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

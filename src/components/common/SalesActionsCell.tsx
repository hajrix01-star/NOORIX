/**
 * SalesActionsCell — قائمة إجراءات احترافية لملخص المبيعات
 */
import React, { memo, useMemo } from 'react';
import { hasPermission } from '../../constants/permissions';
import { useTranslation } from '../../i18n/useTranslation';
import { KebabMenu } from '../../ui';
import type { SalesSummaryDayRow } from '../../types/api/domains/sales';

export type SalesActionsCellProps = {
  summary: SalesSummaryDayRow;
  userRole?: string;
  userPermissions?: unknown;
  onPrint?: (summary: SalesSummaryDayRow) => void;
  onEdit?: (summary: SalesSummaryDayRow) => void;
  onDelete?: (summary: SalesSummaryDayRow) => void;
};

export const SalesActionsCell = memo(function SalesActionsCell({
  summary, userRole, userPermissions, onPrint, onEdit, onDelete,
}: SalesActionsCellProps) {
  const { t } = useTranslation();

  const canPrint = hasPermission(userRole, 'SALES_READ', userPermissions);
  const canEdit  = hasPermission(userRole, 'SALES_WRITE', userPermissions) || hasPermission(userRole, 'SALES_ACTIONS', userPermissions);
  const canDel   = (userRole || '').toLowerCase() === 'owner';
  const showAny  = canPrint || canEdit || canDel;

  const items = useMemo(() => [
    {
      key: 'print',
      label: t('printWhatsApp'),
      hidden: !canPrint,
      style: { color: 'var(--noorix-accent-blue)' },
      onClick: () => onPrint?.(summary),
    },
    {
      key: 'edit',
      label: t('edit'),
      hidden: !(canEdit && summary.status === 'active'),
      style: { color: 'var(--noorix-accent-green)' },
      onClick: () => onEdit?.(summary),
    },
    {
      key: 'delete',
      label: t('delete'),
      hidden: !(canDel && onDelete),
      style: { color: 'var(--noorix-accent-red)' },
      onClick: () => onDelete?.(summary),
    },
  ], [canPrint, canEdit, canDel, summary, t, onPrint, onEdit, onDelete]);

  if (!showAny) return <span className="nx-cell-muted">—</span>;

  return (
    <KebabMenu
      ariaLabel={t('actions')}
      items={items}
      menuMaxHeight={220}
    />
  );
});

export default SalesActionsCell;

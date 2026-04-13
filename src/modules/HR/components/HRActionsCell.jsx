/**
 * HRActionsCell — قائمة إجراءات منسدلة (Kebab) لصفوف HR
 */
import React, { memo, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { KebabMenu } from '../../../ui';

export const HRActionsCell = memo(function HRActionsCell({
  row,
  type: _type, // 'payroll' | 'leave' | 'advance' | 'residency'
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
  onReturnFromLeave,
}) {
  const { t } = useTranslation();

  const items = useMemo(() => [
    { key: 'view', label: t('view'), hidden: !onView, style: { color: 'var(--noorix-text)' }, onClick: () => onView?.(row) },
    { key: 'edit', label: t('edit'), hidden: !onEdit, style: { color: 'var(--noorix-accent-green)' }, onClick: () => onEdit?.(row) },
    { key: 'approve', label: t('statusApproved'), hidden: !onApprove, style: { color: 'var(--noorix-accent-green)' }, onClick: () => onApprove?.(row) },
    { key: 'reject', label: t('statusRejected'), hidden: !onReject, style: { color: 'var(--noorix-accent-red)' }, onClick: () => onReject?.(row) },
    { key: 'returnLeave', label: t('leaveReturnFromLeave'), hidden: !onReturnFromLeave, style: { color: 'var(--noorix-accent-blue)' }, onClick: () => onReturnFromLeave?.(row) },
    { key: 'pay', label: t('payrollPay') || 'صرف المسيرة', hidden: !onPay, style: { color: 'var(--noorix-accent-blue)' }, onClick: () => onPay?.(row) },
    { key: 'advance', label: t('quickAdvance') || 'صرف سلفة', hidden: !onAdvance, style: { color: 'var(--color-noorix-amber)' }, onClick: () => onAdvance?.(row) },
    { key: 'settle', label: t('settleAdvance') || 'تسديد السلفة', hidden: !onSettle, style: { color: 'var(--noorix-accent-amber)' }, onClick: () => onSettle?.(row) },
    { key: 'terminate', label: t('terminateEmployee'), hidden: !onTerminate, style: { color: 'var(--noorix-accent-red)' }, onClick: () => onTerminate?.(row) },
    { key: 'archive', label: t('archiveEmployee'), hidden: !onArchive, style: { color: 'var(--noorix-text-muted)' }, onClick: () => onArchive?.(row) },
    { key: 'restore', label: t('restoreEmployee'), hidden: !onRestore, style: { color: 'var(--noorix-accent-green)' }, onClick: () => onRestore?.(row) },
    { key: 'delete', label: t('delete'), hidden: !onDelete, style: { color: 'var(--noorix-accent-red)' }, onClick: () => onDelete?.(row) },
    { key: 'permdelete', label: t('deleteEmployeePermanent'), hidden: !onPermanentDelete, style: { color: 'var(--noorix-accent-red-dark)' }, onClick: () => onPermanentDelete?.(row) },
  ], [row, t, onView, onEdit, onApprove, onReject, onReturnFromLeave, onPay, onAdvance, onSettle, onTerminate, onArchive, onRestore, onDelete, onPermanentDelete]);

  const hasAny = items.some((x) => !x.hidden);
  if (!hasAny) return <span className="text-[12px] text-noorix-muted">—</span>;

  return (
    <KebabMenu
      ariaLabel={t('actions')}
      items={items}
      menuMaxHeight={280}
    />
  );
});

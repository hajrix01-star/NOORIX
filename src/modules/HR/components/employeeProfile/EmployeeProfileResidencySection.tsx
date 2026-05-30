import { formatSaudiDate } from '../../../../utils/saudiDate';
import { hrFmt } from '../../utils/hrFmt';
import { Badge, Button, KebabMenu, SmartTable, cn } from '../../../../ui';
import { HRActionsCell } from '../HRActionsCell';
import { HR_SERVICE_CATEGORY_LABEL_KEYS, formatHrServiceDetail, formatHrServiceSecondaryDate } from '../../constants/employeeHrServiceCategories';
import { HrServiceQuickAddBar } from '../HrServiceQuickAddBar';

export function EmployeeProfileResidencySection({
  t,
  residencies,
  residencyProfileStatusMap,
  canAddService,
  canEditService,
  onQuickAdd,
  onOpenService,
  onDeleteService,
}: any) {
  const enrichedRows = (residencies || []).map((row: any) => ({
    ...row,
    invoiceNumber: row.invoice?.invoiceNumber || null,
    invoiceAmount: row.residencyInvoiceAmount ?? row.invoice?.totalAmount,
  }));

  const serviceKebabItems = (row: any) => [
    { key: 'view', label: t('view'), onClick: () => onOpenService?.(row) },
    {
      key: 'edit',
      label: t('edit'),
      style: { color: 'var(--noorix-accent-green)' },
      onClick: () => onOpenService?.(row),
    },
    ...(canEditService && onDeleteService ? [{
      key: 'delete',
      label: t('delete'),
      style: { color: 'var(--noorix-accent-red)' },
      onClick: () => onDeleteService(row),
    }] : []),
  ];

  return (
    <div className="noorix-surface-card overflow-hidden">
      <div className="nx-section-header flex flex-wrap items-center justify-between gap-2">
        <span className="nx-section-header__title">{t('hrEmployeeServicesProfile')}</span>
        {canAddService && (
          <Button size="sm" variant="primary" onClick={() => onQuickAdd?.('iqama_renewal')}>
            {t('addHrService')}
          </Button>
        )}
      </div>
      {canAddService && onQuickAdd && (
        <div className="px-3 pb-3 border-b border-noorix-border">
          <HrServiceQuickAddBar hideLabel onSelectCategory={onQuickAdd} />
        </div>
      )}
      <SmartTable
        compact
        showRowNumbers
        rowNumberWidth="1%"
        innerPadding={8}
        columns={[
          {
            key: 'serviceCategory',
            label: t('hrServiceCategory'),
            width: '18%',
            render: (_v: any, row: any) => (
              <Badge
                color="blue"
                size="sm"
                label={t(HR_SERVICE_CATEGORY_LABEL_KEYS[row.serviceCategory || 'iqama_renewal'] || 'hrServiceIqamaRenewal')}
              />
            ),
          },
          {
            key: 'serviceDetail',
            label: t('hrServiceDetailColumn'),
            width: '18%',
            render: (_v: any, row: any) => (
              <button
                type="button"
                className="text-[12px] text-start text-noorix-blue hover:underline cursor-pointer bg-transparent border-0 p-0"
                onClick={() => onOpenService?.(row)}
              >
                {formatHrServiceDetail(row, t)}
              </button>
            ),
          },
          {
            key: 'secondary',
            label: t('hrServiceSecondaryColumn'),
            width: '16%',
            render: (_v: any, row: any) => (
              <span className="nx-cell-muted-sm">{formatHrServiceSecondaryDate(row, t, formatSaudiDate)}</span>
            ),
          },
          {
            key: 'invoiceNumber',
            label: t('invoiceNumber'),
            width: '14%',
            render: (_v: any, row: any) => (
              row.invoiceNumber ? (
                <button
                  type="button"
                  className="nx-cell-num text-noorix-blue font-semibold hover:underline cursor-pointer bg-transparent border-0 p-0"
                  onClick={() => onOpenService?.(row)}
                >
                  {row.invoiceNumber}
                </button>
              ) : (
                <span className="text-noorix-muted text-[12px]">{t('hrServiceNoInvoice')}</span>
              )
            ),
          },
          {
            key: 'status',
            label: t('status'),
            width: '14%',
            render: (v: any) => <Badge {...Badge.fromStatus(v, residencyProfileStatusMap)} size="sm" />,
          },
          ...(canEditService
            ? [{
                key: 'actions',
                label: t('actions'),
                width: '10%',
                align: 'center',
                render: (_: any, row: any) => (
                  <HRActionsCell
                    row={row}
                    type="residency"
                    onView={() => onOpenService?.(row)}
                    onEdit={() => onOpenService?.(row)}
                    onDelete={onDeleteService ? () => onDeleteService(row) : undefined}
                  />
                ),
              }]
            : []),
        ]}
        data={enrichedRows}
        total={enrichedRows.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: any) => (
          <div
            className={cn(canEditService && 'cursor-pointer')}
            onClick={canEditService ? () => onOpenService?.(row) : undefined}
            role={canEditService ? 'button' : undefined}
            tabIndex={canEditService ? 0 : undefined}
          >
            <div className="nx-cr__line1">
              <span className={cn('nx-cr__id', canEditService && 'text-noorix-blue')}>
                {row.iqamaNumber || row.referenceLabel || '—'}
              </span>
              <Badge
                color="blue"
                size="sm"
                label={t(HR_SERVICE_CATEGORY_LABEL_KEYS[row.serviceCategory || 'iqama_renewal'] || 'hrServiceIqamaRenewal')}
              />
              <Badge {...Badge.fromStatus(row.status, residencyProfileStatusMap)} size="sm" />
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">
                <span className="nx-cr__meta ltr">{formatSaudiDate(row.issueDate)} → {formatSaudiDate(row.expiryDate)}</span>
              </div>
              <div className="nx-cr__line2-end flex items-center gap-2">
                {row.invoiceNumber && (
                  <span className="text-[12px] ltr text-noorix-blue">{row.invoiceNumber}</span>
                )}
                {canEditService && (
                  <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
                    <KebabMenu ariaLabel={t('actions')} items={serviceKebabItems(row)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: any) => (
          <div
            className={cn('flex flex-col gap-2', canEditService && 'cursor-pointer')}
            onClick={canEditService ? () => onOpenService?.(row) : undefined}
            role={canEditService ? 'button' : undefined}
            tabIndex={canEditService ? 0 : undefined}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge
                color="blue"
                size="sm"
                label={t(HR_SERVICE_CATEGORY_LABEL_KEYS[row.serviceCategory || 'iqama_renewal'] || 'hrServiceIqamaRenewal')}
              />
              <Badge {...Badge.fromStatus(row.status, residencyProfileStatusMap)} size="sm" />
            </div>
            <div className="nx-cell-num text-[14px] font-bold ltr text-end">{row.iqamaNumber || row.referenceLabel || '—'}</div>
            {row.invoiceNumber && (
              <div className="text-[12px] text-noorix-blue ltr text-end">{row.invoiceNumber}</div>
            )}
            <div className="nx-mc__grid nx-mc__grid--2">
              <div>
                <div className="nx-mc__stat-label">{t('startDate')}</div>
                <div className="text-[12px] text-noorix-text">{formatSaudiDate(row.issueDate)}</div>
              </div>
              <div>
                <div className="nx-mc__stat-label">{t('expiryDate')}</div>
                <div className="text-[12px] text-noorix-text">{formatSaudiDate(row.expiryDate)}</div>
              </div>
            </div>
            {canEditService && (
              <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <KebabMenu ariaLabel={t('actions')} items={serviceKebabItems(row)} />
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}

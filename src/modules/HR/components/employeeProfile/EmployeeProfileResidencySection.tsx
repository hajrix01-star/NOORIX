import { formatSaudiDate } from '../../../../utils/saudiDate';
import { Badge, Button, SmartTable, cn } from '../../../../ui';
import { HR_SERVICE_CATEGORY_LABEL_KEYS, formatHrServiceDetail, formatHrServiceSecondaryDate } from '../../constants/employeeHrServiceCategories';
import { HrServiceQuickAddBar } from '../HrServiceQuickAddBar';

type TranslationFn = (key: string, ...args: unknown[]) => string;
type ProfileResidencyRow = Record<string, unknown> & {
  id?: string | null;
  serviceCategory?: string | null;
  iqamaNumber?: string | null;
  referenceLabel?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  status?: string | null;
  invoiceId?: string | null;
  invoice?: { invoiceNumber?: string | number | null; totalAmount?: number | string | null } | null;
  invoiceNumber?: string | number | null;
  residencyInvoiceAmount?: number | string | null;
  invoiceAmount?: number | string | null;
};
type EmployeeProfileResidencySectionProps = {
  t: TranslationFn;
  residencies: ProfileResidencyRow[];
  residencyProfileStatusMap: Record<string, unknown>;
  canAddService?: boolean;
  canEditService?: boolean;
  onQuickAdd?: (category: string) => void;
  onOpenService?: (row: ProfileResidencyRow) => void;
  onDeleteService?: (row: ProfileResidencyRow) => void;
};

export function EmployeeProfileResidencySection({
  t,
  residencies,
  residencyProfileStatusMap,
  canAddService,
  canEditService,
  onQuickAdd,
  onOpenService,
}: EmployeeProfileResidencySectionProps) {
  const enrichedRows = (residencies || []).map((row) => ({
    ...row,
    invoiceNumber: row.invoice?.invoiceNumber || null,
    invoiceAmount: row.residencyInvoiceAmount ?? row.invoice?.totalAmount,
  }));

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
        innerPadding={8}
        columns={[
          {
            key: 'serviceCategory',
            label: t('hrServiceCategory'),
            size: 'supplier',
            render: (_v: unknown, row: ProfileResidencyRow) => (
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
            size: 'name',
            render: (_v: unknown, row: ProfileResidencyRow) => (
              <Button
                variant="raw"
                type="button"
                className="text-[12px] text-start text-noorix-blue hover:underline cursor-pointer bg-transparent border-0 p-0"
                onClick={() => onOpenService?.(row)}
              >
                {formatHrServiceDetail(row, t)}
              </Button>
            ),
          },
          {
            key: 'secondary',
            label: t('hrServiceSecondaryColumn'),
            size: 'date',
            render: (_v: unknown, row: ProfileResidencyRow) => (
              <span className="nx-cell-muted-sm">{formatHrServiceSecondaryDate(row, t, formatSaudiDate)}</span>
            ),
          },
          {
            key: 'invoiceNumber',
            label: t('invoiceNumber'),
            size: 'document',
            render: (_v: unknown, row: ProfileResidencyRow) => (
              row.invoiceNumber ? (
                <Button
                  variant="raw"
                  type="button"
                  className="nx-cell-num text-noorix-blue font-semibold hover:underline cursor-pointer bg-transparent border-0 p-0"
                  onClick={() => onOpenService?.(row)}
                >
                  {row.invoiceNumber}
                </Button>
              ) : (
                <span className="text-noorix-muted text-[12px]">{t('hrServiceNoInvoice')}</span>
              )
            ),
          },
          {
            key: 'status',
            label: t('status'),
            kind: 'status',
            render: (v: unknown) => <Badge {...Badge.fromStatus(v, residencyProfileStatusMap)} size="sm" />,
          },
        ]}
        data={enrichedRows}
        total={enrichedRows.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: ProfileResidencyRow) => (
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
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: ProfileResidencyRow) => (
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
          </div>
        )}
      />
    </div>
  );
}

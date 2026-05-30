import { formatSaudiDate } from '../../../../utils/saudiDate';
import { Badge, Button, SmartTable } from '../../../../ui';
import { HR_SERVICE_CATEGORY_LABEL_KEYS } from '../../constants/employeeHrServiceCategories';
import { HrServiceQuickAddBar } from '../HrServiceQuickAddBar';

export function EmployeeProfileResidencySection({
  t,
  residencies,
  residencyProfileStatusMap,
  canAddService,
  onQuickAdd,
}: any) {
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
            width: '22%',
            render: (_v: any, row: any) => (
              <Badge
                color="blue"
                size="sm"
                label={t(HR_SERVICE_CATEGORY_LABEL_KEYS[row.serviceCategory || 'iqama_renewal'] || 'hrServiceIqamaRenewal')}
              />
            ),
          },
          {
            key: 'iqamaNumber',
            label: t('iqamaNumber'),
            width: '20%',
            render: (v: any, row: any) => <span className="nx-cell-num">{v || row.referenceLabel || '—'}</span>,
          },
          {
            key: 'issueDate',
            label: t('startDate'),
            width: '25%',
            render: (v: any) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>,
          },
          {
            key: 'expiryDate',
            label: t('expiryDate'),
            width: '25%',
            render: (v: any) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>,
          },
          {
            key: 'status',
            label: t('status'),
            width: '24%',
            render: (v: any) => <Badge {...Badge.fromStatus(v, residencyProfileStatusMap)} size="sm" />,
          },
        ]}
        data={residencies}
        total={residencies.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: any) => (
          <div>
            <div className="nx-cr__line1">
              <span className="nx-cr__id">{row.iqamaNumber || row.referenceLabel || '—'}</span>
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
            </div>
          </div>
        )}
        renderMobileCard={(row: any) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge
                color="blue"
                size="sm"
                label={t(HR_SERVICE_CATEGORY_LABEL_KEYS[row.serviceCategory || 'iqama_renewal'] || 'hrServiceIqamaRenewal')}
              />
              <Badge {...Badge.fromStatus(row.status, residencyProfileStatusMap)} size="sm" />
            </div>
            <div className="nx-cell-num text-[14px] font-bold ltr text-end">{row.iqamaNumber || row.referenceLabel || '—'}</div>
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

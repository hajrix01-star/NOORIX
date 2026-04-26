import { formatSaudiDate } from '../../../../utils/saudiDate';
import { Badge, SmartTable } from '../../../../ui';

export function EmployeeProfileResidencySection({ t, residencies, residencyProfileStatusMap }) {
  return (
    <div className="noorix-surface-card overflow-hidden">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('hrTabResidency')}</span>
      </div>
      <SmartTable
        compact
        showRowNumbers
        rowNumberWidth="1%"
        innerPadding={8}
        columns={[
          {
            key: 'iqamaNumber',
            label: t('iqamaNumber'),
            width: '25%',
            render: (v) => <span className="nx-cell-num">{v || '—'}</span>,
          },
          {
            key: 'issueDate',
            label: t('startDate'),
            width: '25%',
            render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>,
          },
          {
            key: 'expiryDate',
            label: t('expiryDate'),
            width: '25%',
            render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>,
          },
          {
            key: 'status',
            label: t('status'),
            width: '24%',
            render: (v) => <Badge {...Badge.fromStatus(v, residencyProfileStatusMap)} size="sm" />,
          },
        ]}
        data={residencies}
        total={residencies.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderMobileCard={(row) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="nx-cell-num text-[14px] font-bold ltr">{row.iqamaNumber || '—'}</span>
              <Badge {...Badge.fromStatus(row.status, residencyProfileStatusMap)} size="sm" />
            </div>
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

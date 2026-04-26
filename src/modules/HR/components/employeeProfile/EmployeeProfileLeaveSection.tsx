import { formatSaudiDate } from '../../../../utils/saudiDate';
import { Badge, SmartTable } from '../../../../ui';
import { HRActionsCell } from '../HRActionsCell';
import { TYPE_MAP } from './employeeProfileModel';

export function EmployeeProfileLeaveSection({
  t,
  leaves,
  leaveProfileStatusMap,
  canEditHrLeave,
  onEditLeave,
}) {
  return (
    <div className="noorix-surface-card overflow-hidden">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('hrTabLeave')}</span>
      </div>
      <SmartTable
        compact
        showRowNumbers
        rowNumberWidth="1%"
        innerPadding={8}
        columns={[
          {
            key: 'leaveType',
            label: t('leaveType'),
            width: '16%',
            render: (v) => t(TYPE_MAP[v] || 'leaveOther'),
          },
          {
            key: 'startDate',
            label: t('startDate'),
            width: '16%',
            render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>,
          },
          {
            key: 'endDate',
            label: t('endDate'),
            width: '16%',
            render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>,
          },
          {
            key: 'daysCount',
            label: t('daysCount'),
            numeric: true,
            width: '10%',
            render: (v) => <span className="nx-cell-num">{v ?? '—'}</span>,
          },
          {
            key: 'status',
            label: t('status'),
            width: '14%',
            render: (v) => <Badge {...Badge.fromStatus(v, leaveProfileStatusMap)} size="sm" />,
          },
          ...(canEditHrLeave
            ? [
                {
                  key: 'actions',
                  label: t('actions'),
                  width: '10%',
                  align: 'center',
                  render: (_, row) => (
                    <HRActionsCell row={row} type="leave" onEdit={() => onEditLeave(row)} />
                  ),
                },
              ]
            : []),
        ]}
        data={leaves}
        total={leaves.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderMobileCard={(row) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px] font-bold text-noorix-text">
                {t(TYPE_MAP[row.leaveType] || 'leaveOther')}
              </span>
              <Badge {...Badge.fromStatus(row.status, leaveProfileStatusMap)} size="sm" />
            </div>
            <div className="nx-mc__grid nx-mc__grid--3">
              <div>
                <div className="nx-mc__stat-label">{t('startDate')}</div>
                <div className="text-[12px] text-noorix-text">{formatSaudiDate(row.startDate)}</div>
              </div>
              <div>
                <div className="nx-mc__stat-label">{t('endDate')}</div>
                <div className="text-[12px] text-noorix-text">{formatSaudiDate(row.endDate)}</div>
              </div>
              <div>
                <div className="nx-mc__stat-label">{t('daysCount')}</div>
                <div className="text-[13px] font-semibold ltr">{row.daysCount ?? '—'}</div>
              </div>
            </div>
            {canEditHrLeave ? (
              <div className="nx-mc__actions border-t border-noorix-border pt-2">
                <HRActionsCell
                  row={row}
                  type="leave"
                  onEdit={() => onEditLeave(row)}
                />
              </div>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}

import { formatSaudiDate } from '../../../../utils/saudiDate';
import { Badge, KebabMenu, SmartTable } from '../../../../ui';
import { HRActionsCell } from '../HRActionsCell';
import { TYPE_MAP } from './employeeProfileModel';

type TranslationFn = (key: string, ...args: unknown[]) => string;
type ProfileLeaveRow = Record<string, unknown> & {
  id?: string | null;
  leaveType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  daysCount?: number | string | null;
  status?: string | null;
};
type EmployeeProfileLeaveSectionProps = {
  t: TranslationFn;
  leaves: ProfileLeaveRow[];
  leaveProfileStatusMap: Record<string, unknown>;
  canEditHrLeave?: boolean;
  onEditLeave: (row: ProfileLeaveRow) => void;
};

export function EmployeeProfileLeaveSection({
  t,
  leaves,
  leaveProfileStatusMap,
  canEditHrLeave,
  onEditLeave,
}: EmployeeProfileLeaveSectionProps) {
  return (
    <div className="noorix-surface-card overflow-hidden">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('hrTabLeave')}</span>
      </div>
      <SmartTable
        compact
        showRowNumbers
        innerPadding={8}
        columns={[
          {
            key: 'leaveType',
            label: t('leaveType'),
            width: '16%',
            render: (v: unknown) => t((TYPE_MAP as Record<string, string>)[String(v)] || 'leaveOther'),
          },
          {
            key: 'startDate',
            label: t('startDate'),
            width: '16%',
            render: (v: unknown) => <span className="nx-cell-muted-sm">{formatSaudiDate(String(v || ''))}</span>,
          },
          {
            key: 'endDate',
            label: t('endDate'),
            width: '16%',
            render: (v: unknown) => <span className="nx-cell-muted-sm">{formatSaudiDate(String(v || ''))}</span>,
          },
          {
            key: 'daysCount',
            label: t('daysCount'),
            numeric: true,
            width: '10%',
            render: (v: unknown) => <span className="nx-cell-num">{String(v ?? '—')}</span>,
          },
          {
            key: 'status',
            label: t('status'),
            width: '14%',
            render: (v: unknown) => <Badge {...Badge.fromStatus(v, leaveProfileStatusMap)} size="sm" />,
          },
          ...(canEditHrLeave
            ? [
                {
                  key: 'actions',
                  label: t('actions'),
                  width: '10%',
                  align: 'center',
                  render: (_: unknown, row: ProfileLeaveRow) => (
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
        renderCompactRow={(row: ProfileLeaveRow) => (
          <div>
            <div className="nx-cr__line1">
              <span className="nx-cr__name">{t((TYPE_MAP as Record<string, string>)[String(row.leaveType)] || 'leaveOther')}</span>
              <Badge {...Badge.fromStatus(row.status, leaveProfileStatusMap)} size="sm" />
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">
                <span className="nx-cr__meta ltr">{formatSaudiDate(row.startDate)} → {formatSaudiDate(row.endDate)}</span>
              </div>
              <div className="nx-cr__line2-end">
                <span className="nx-cr__amount">{row.daysCount ?? '—'} {t('daysCount')}</span>
                {canEditHrLeave && (
                  <div className="nx-cr__kebab" onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
                    <KebabMenu ariaLabel={t('actions')} items={[{ key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => onEditLeave(row) }]} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: ProfileLeaveRow) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px] font-bold text-noorix-text">
                {t((TYPE_MAP as Record<string, string>)[String(row.leaveType)] || 'leaveOther')}
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

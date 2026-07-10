import { formatSaudiDate } from '../../../../utils/saudiDate';
import { Badge, Button, SmartTable } from '../../../../ui';
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
            size: 'supplier',
            render: (v: unknown, row: ProfileLeaveRow) => (
              canEditHrLeave ? (
                <Button
                  variant="raw"
                  size="auto"
                  className="text-[13px] font-semibold text-noorix-blue hover:underline"
                  onClick={() => onEditLeave(row)}
                >
                  {t((TYPE_MAP as Record<string, string>)[String(v)] || 'leaveOther')}
                </Button>
              ) : (
                t((TYPE_MAP as Record<string, string>)[String(v)] || 'leaveOther')
              )
            ),
          },
          {
            key: 'startDate',
            label: t('startDate'),
            size: 'date',
            render: (v: unknown) => <span className="nx-cell-muted-sm">{formatSaudiDate(String(v || ''))}</span>,
          },
          {
            key: 'endDate',
            label: t('endDate'),
            size: 'date',
            render: (v: unknown) => <span className="nx-cell-muted-sm">{formatSaudiDate(String(v || ''))}</span>,
          },
          {
            key: 'daysCount',
            label: t('daysCount'),
            numeric: true,
            size: 'count',
            render: (v: unknown) => <span className="nx-cell-num">{String(v ?? '—')}</span>,
          },
          {
            key: 'status',
            label: t('status'),
            kind: 'status',
            render: (v: unknown) => <Badge {...Badge.fromStatus(v, leaveProfileStatusMap)} size="sm" />,
          },
        ]}
        data={leaves}
        total={leaves.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: ProfileLeaveRow) => (
          <div
            className={canEditHrLeave ? 'cursor-pointer' : undefined}
            role={canEditHrLeave ? 'button' : undefined}
            tabIndex={canEditHrLeave ? 0 : undefined}
            onClick={canEditHrLeave ? () => onEditLeave(row) : undefined}
            onKeyDown={canEditHrLeave ? (event) => { if (event.key === 'Enter') onEditLeave(row); } : undefined}
          >
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
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: ProfileLeaveRow) => (
          <div
            className={canEditHrLeave ? 'flex flex-col gap-2 cursor-pointer' : 'flex flex-col gap-2'}
            role={canEditHrLeave ? 'button' : undefined}
            tabIndex={canEditHrLeave ? 0 : undefined}
            onClick={canEditHrLeave ? () => onEditLeave(row) : undefined}
            onKeyDown={canEditHrLeave ? (event) => { if (event.key === 'Enter') onEditLeave(row); } : undefined}
          >
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
          </div>
        )}
      />
    </div>
  );
}

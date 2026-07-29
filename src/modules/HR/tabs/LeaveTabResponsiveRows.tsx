import { Badge } from '../../../ui';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { LEAVE_TYPE_MAP, type HrLeaveRow } from './leaveTabModel';

type TranslationFn = (key: string, ...args: string[]) => string;

type LeaveRowViewProps = {
  row: HrLeaveRow & { employeeName?: string };
  t: TranslationFn;
  onOpen: (row: HrLeaveRow) => void;
};

export function LeaveMobileCard({ row, t, onOpen }: LeaveRowViewProps) {
  return (
    <div
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={(event) => { if (event.key === 'Enter') onOpen(row); }}
    >
      <div className="flex items-center justify-between flex flex-wrap mb-1">
        <span className="font-bold text-[14px]">{String(row.employeeName || '-')}</span>
      </div>
      <div className="text-[13px] text-noorix-muted mb-2 text-end">
        {t(LEAVE_TYPE_MAP[row.leaveType as keyof typeof LEAVE_TYPE_MAP] || 'leaveOther')}
      </div>
      {Boolean(row.salarySettlement) && (
        <div className="text-[11px] font-semibold text-noorix-green text-end mb-1">{t('leaveSalarySettledBadge')}</div>
      )}
      <div className="nx-mc__grid nx-mc__grid--3 mb-2.5">
        <div>
          <div className="nx-mc__stat-label">{t('startDate')}</div>
          <div className="nx-mc__stat-value text-[13px]">{formatSaudiDate(row.startDate)}</div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('endDate')}</div>
          <div className="nx-mc__stat-value text-[13px]">{formatSaudiDate(row.endDate)}</div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('daysCount')}</div>
          <div className="nx-mc__stat-value text-[14px] font-bold">{row.daysCount ?? '-'}</div>
        </div>
      </div>
    </div>
  );
}

export function LeaveCompactRow({ row, t, onOpen }: LeaveRowViewProps) {
  return (
    <div
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={(event) => { if (event.key === 'Enter') onOpen(row); }}
    >
      <div className="nx-cr__line1">
        <span className="nx-cr__name">{String(row.employeeName || '-')}</span>
        <span className="nx-cr__sub">{t(LEAVE_TYPE_MAP[row.leaveType as keyof typeof LEAVE_TYPE_MAP] || 'leaveOther')}</span>
        {Boolean(row.salarySettlement) && <Badge color="green" size="sm">{t('leaveSalarySettledBadge')}</Badge>}
      </div>
      <div className="nx-cr__line2">
        <div className="nx-cr__line2-start">
          <span className="nx-cr__meta ltr">{formatSaudiDate(row.startDate)} - {formatSaudiDate(row.endDate)}</span>
        </div>
        <div className="nx-cr__line2-end">
          <span className="nx-cr__amount">{row.daysCount ?? '-'} {t('daysCount')}</span>
        </div>
      </div>
    </div>
  );
}

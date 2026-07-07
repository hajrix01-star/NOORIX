import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, cn, FmtNum, KebabMenu } from '../../../ui';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import type { HrEmployee } from '../../../types/api';

type TranslationFn = (key: string, ...args: unknown[]) => string;
type StaffMobileRow = HrEmployee & {
  totalSalary?: number | null;
};
type StaffMenuItem = {
  key: string;
  label: string;
  onClick: () => void;
  style?: React.CSSProperties;
};

type StaffListMobileRowProps = {
  row: StaffMobileRow;
  lang: string;
  t: TranslationFn;
  statusMap: Record<string, unknown>;
  renderMenuItems: (row: StaffMobileRow) => StaffMenuItem[];
};

export function StaffListMobileRow({
  row,
  lang,
  t,
  statusMap,
  renderMenuItems,
}: StaffListMobileRowProps) {
  const navigate = useNavigate();
  const displayName = employeeDisplayName(row, lang);

  return (
    <div
      className={cn('nx-hr-staff-row__inner flex min-w-0 cursor-pointer items-start justify-between gap-3')}
      onClick={() => navigate(`/hr/employee/${row.id}`)}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className="font-bold text-[14px] text-noorix-blue truncate"
          title={displayName}
        >
          {displayName}
        </span>
        <span className="text-[11px] text-noorix-muted">
          {formatSaudiDate(row.joinDate)}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 min-w-0">
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
          {row.jobTitle && (
            <span
              className="max-w-[11rem] truncate text-[12px] text-noorix-muted sm:max-w-[9.5rem]"
              title={row.jobTitle}
            >
              {row.jobTitle}
            </span>
          )}
          <Badge {...Badge.fromStatus(row.status, statusMap)} size="sm" />
        </div>
        <div className="flex items-center gap-2">
          <span className="nx-cr__amount text-noorix-green">
            {Number.isFinite(Number(row.totalSalary)) ? (
              <>
                <FmtNum n={Number(row.totalSalary)} /> <span className="nx-sar">SR</span>
              </>
            ) : (
              <span className="nx-cell-muted">—</span>
            )}
          </span>
          <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
            <KebabMenu
              ariaLabel={t('actions')}
              items={renderMenuItems(row)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

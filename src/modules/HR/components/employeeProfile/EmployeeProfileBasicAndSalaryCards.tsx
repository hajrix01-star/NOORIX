import { formatSaudiDate } from '../../../../utils/saudiDate';
import { employeeDisplayName } from '../../../../utils/employeeDisplayName';
import { hrFmt } from '../../utils/hrFmt';
import { Badge } from '../../../../ui';
import { ProfileInfoRow } from './ProfileInfoRow';
import { getInitials } from './employeeProfileModel';
import type { HrEmployee } from '../../../../types/api';

type TranslationFn = (key: string, ...args: unknown[]) => string;
type EmployeeProfileEmployee = HrEmployee & {
  terminationDate?: string | null;
};
type SalaryRow = {
  label: string;
  amount: number;
  strong?: boolean;
  total?: boolean;
};

export function EmployeeProfileBasicInfoCard({
  employee,
  lang,
  empStatusMap,
  t,
}: {
  employee: EmployeeProfileEmployee;
  lang: string;
  empStatusMap: Record<string, unknown>;
  t: TranslationFn;
}) {
  return (
    <div className="noorix-surface-card p-4 md:p-6">
      <div className="flex items-start gap-4 mb-5">
        <div className="w-14 h-14 rounded-full bg-noorix-blue flex items-center justify-center text-white text-[20px] font-bold shrink-0 select-none">
          {getInitials(employeeDisplayName(employee, lang))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-[18px] font-bold text-noorix-text m-0 leading-snug">
              {employeeDisplayName(employee, lang)}
            </h2>
            <Badge {...Badge.fromStatus(employee.status, empStatusMap)} />
          </div>
          <p className="text-noorix-muted text-[13px] m-0">{employee.jobTitle || '—'}</p>
        </div>
      </div>
      <div className="border-t border-noorix-border pt-1">
        <ProfileInfoRow label={t('employeeSerial')} value={employee.employeeSerial} />
        <ProfileInfoRow label={t('joinDate')} value={formatSaudiDate(employee.joinDate)} />
        {employee.workHours ? (
          <ProfileInfoRow label={t('workHours')} value={String(employee.workHours)} />
        ) : null}
        {employee.status === 'terminated' && employee.terminationDate ? (
          <ProfileInfoRow
            label={t('terminationDate')}
            value={formatSaudiDate(employee.terminationDate)}
            accent
          />
        ) : null}
      </div>
    </div>
  );
}

export function EmployeeProfileSalaryCard({
  t,
  salaryRows,
  total,
}: {
  t: TranslationFn;
  salaryRows: SalaryRow[];
  total: number;
}) {
  return (
    <div className="noorix-surface-card p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 mb-4">
        <h2 className="text-[16px] font-bold text-noorix-text m-0">{t('salaryBreakdown')}</h2>
        <div className="text-end shrink-0">
          <div className="text-[11px] text-noorix-muted mb-0.5">{t('totalSalary')}</div>
          <div className="text-[22px] font-bold text-noorix-green ltr">{hrFmt(total)}</div>
        </div>
      </div>
      <div className="border border-noorix-border rounded-xl overflow-hidden">
        {salaryRows
          .filter((r) => !r.total)
          .map((row, idx) => (
            <div key={`${row.label}-${idx}`} className="employee-profile-salary-row">
              <div
                className={
                  row.strong
                    ? 'employee-profile-salary-row__label employee-profile-salary-row__label--strong'
                    : 'employee-profile-salary-row__label'
                }
              >
                {row.label}
              </div>
              <div className="employee-profile-salary-row__amount">{hrFmt(row.amount)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}

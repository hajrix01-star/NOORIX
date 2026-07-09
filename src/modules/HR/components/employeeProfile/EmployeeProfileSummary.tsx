import { employeeDisplayName } from '../../../../utils/employeeDisplayName';
import { formatSaudiDate } from '../../../../utils/saudiDate';
import { Badge } from '../../../../ui';
import { hrFmt } from '../../utils/hrFmt';
import { getInitials, type EmployeeProfileSummary as EmployeeProfileSummaryModel } from './employeeProfileModel';
import type { HrEmployee } from '../../../../types/api';
import type { ChangeEventHandler } from 'react';

type TranslationFn = (key: string, ...args: unknown[]) => string;

type EmployeeProfileSummaryProps = {
  employee: HrEmployee & { terminationDate?: string | null };
  lang: string;
  t: TranslationFn;
  summary: EmployeeProfileSummaryModel;
  empStatusMap: Record<string, unknown>;
  photoUrl?: string;
  photoLoading?: boolean;
  canEditPhoto?: boolean;
  photoBusy?: boolean;
  onPhotoChange?: ChangeEventHandler<HTMLInputElement>;
  onDeletePhoto?: () => void;
};

function SummaryMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'green' | 'amber' | 'blue';
}) {
  return (
    <div className={`employee-profile-metric employee-profile-metric--${tone}`}>
      <span className="employee-profile-metric__label">{label}</span>
      <strong className="employee-profile-metric__value">{value}</strong>
    </div>
  );
}

export function EmployeeProfileSummary({
  employee,
  lang,
  t,
  summary,
  empStatusMap,
  photoUrl,
  photoLoading = false,
  canEditPhoto = false,
  photoBusy = false,
  onPhotoChange,
  onDeletePhoto,
}: EmployeeProfileSummaryProps) {
  const displayName = employeeDisplayName(employee, lang);
  const hasPhoto = Boolean(photoUrl);
  const photoLabel = lang === 'ar' ? 'صورة الموظف' : 'Employee photo';
  return (
    <section className="employee-profile-summary noorix-surface-card">
      <div className="employee-profile-summary__identity">
        <div className="employee-profile-summary__avatar-wrap">
          <div className="employee-profile-summary__avatar" aria-label={photoLabel}>
            {hasPhoto ? (
              <img src={photoUrl} alt={photoLabel} className="employee-profile-summary__avatar-img" />
            ) : (
              getInitials(displayName)
            )}
          </div>
          {canEditPhoto ? (
            <div className="employee-profile-summary__photo-actions">
              <label className="employee-profile-summary__photo-btn">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={onPhotoChange}
                  disabled={photoBusy}
                />
                {photoLoading || photoBusy ? (lang === 'ar' ? 'جار...' : 'Working...') : (hasPhoto ? (lang === 'ar' ? 'تغيير' : 'Change') : (lang === 'ar' ? 'إضافة صورة' : 'Add photo'))}
              </label>
              {hasPhoto ? (
                <button
                  type="button"
                  className="employee-profile-summary__photo-btn employee-profile-summary__photo-btn--ghost"
                  onClick={onDeletePhoto}
                  disabled={photoBusy}
                >
                  {lang === 'ar' ? 'حذف' : 'Remove'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="employee-profile-summary__text">
          <div className="employee-profile-summary__title-row">
            <h1>{displayName}</h1>
            <Badge {...Badge.fromStatus(employee.status, empStatusMap)} />
          </div>
          <div className="employee-profile-summary__meta">
            <span>{employee.jobTitle || '-'}</span>
            <span>{employee.employeeSerial || employee.employeeNumber || '-'}</span>
            <span>{formatSaudiDate(employee.joinDate)}</span>
            {employee.status === 'terminated' && employee.terminationDate ? (
              <span>{formatSaudiDate(employee.terminationDate)}</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="employee-profile-summary__metrics">
        <SummaryMetric label={t('totalSalary')} value={hrFmt(summary.totalSalary)} tone="green" />
        <SummaryMetric label={t('advancesList')} value={summary.activeAdvances} tone="amber" />
        <SummaryMetric label={t('advanceRemainingAmount')} value={hrFmt(summary.pendingAdvanceAmount)} tone="amber" />
        <SummaryMetric label={t('hrTabPayroll')} value={summary.payrollRuns} tone="blue" />
        <SummaryMetric label={t('hrTabLeave')} value={summary.openLeaves} />
        <SummaryMetric label={t('hrEmployeeServicesProfile')} value={summary.services} />
        <SummaryMetric label={t('employeeDocuments')} value={summary.documents} />
        <SummaryMetric label={t('careerRecordTitle')} value={summary.careerMovements} />
      </div>
    </section>
  );
}

import { formatSaudiDate } from '../../../../utils/saudiDate';
import { hrFmt } from '../../utils/hrFmt';
import { Badge, FmtNum, SmartTable } from '../../../../ui';
import type { PayrollProfileItem } from './employeeProfileModel';

type TranslationFn = (key: string, ...args: unknown[]) => string;

type EmployeeProfilePayrollSectionProps = {
  t: TranslationFn;
  payrollItems: PayrollProfileItem[];
  payrollRunStatusMap: Record<string, unknown>;
};

function payrollBadgeProps(row: PayrollProfileItem, t: TranslationFn, payrollRunStatusMap: Record<string, unknown>) {
  const payrollRun = row.payrollRun;
  const status = String(payrollRun?.status || '').toLowerCase();
  return status === 'completed' && payrollRun?.issuedSalaryInvoiceNumber
    ? { color: 'green' as const, children: t('payrollPaid') }
    : Badge.fromStatus(payrollRun?.status, payrollRunStatusMap);
}

export function EmployeeProfilePayrollSection({ t, payrollItems, payrollRunStatusMap }: EmployeeProfilePayrollSectionProps) {
  return (
    <div className="noorix-surface-card overflow-hidden employee-profile-layout__wide">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('hrTabPayroll')}</span>
      </div>
      <SmartTable
        compact
        showRowNumbers
        innerPadding={8}
        columns={[
          {
            key: 'payrollRun.runNumber',
            label: t('payrollRunNumber'),
            size: 'document',
            render: (_: unknown, row: PayrollProfileItem) => (
              <span className="nx-cell-num nx-cell-accent text-[12px]">{row.payrollRun?.runNumber || '-'}</span>
            ),
          },
          {
            key: 'payrollRun.payrollMonth',
            label: t('payrollMonth'),
            size: 'date',
            render: (_: unknown, row: PayrollProfileItem) => (
              <span className="nx-cell-muted-sm">{formatSaudiDate(row.payrollRun?.payrollMonth || '')}</span>
            ),
          },
          { key: 'grossSalary', label: t('grossSalary'), numeric: true, size: 'money-md', render: (value: unknown) => <FmtNum n={Number(value ?? 0)} className="nx-cell-num" /> },
          {
            key: 'deductions',
            label: t('payrollDeductions'),
            numeric: true,
            size: 'money-sm',
            render: (value: unknown) => (
              <span className={Number(value) > 0 ? 'nx-cell-num text-noorix-red' : 'nx-cell-num'}>{hrFmt(Number(value ?? 0))}</span>
            ),
          },
          {
            key: 'advancesDeduct',
            label: t('payrollAdvances'),
            numeric: true,
            size: 'money-sm',
            render: (value: unknown) => (
              <span className={Number(value) > 0 ? 'nx-cell-num text-noorix-amber' : 'nx-cell-num'}>{hrFmt(Number(value ?? 0))}</span>
            ),
          },
          { key: 'netSalary', label: t('netSalary'), numeric: true, size: 'money-md', render: (value: unknown) => <FmtNum n={Number(value ?? 0)} className="nx-cell-num font-bold text-noorix-green" /> },
          {
            key: 'payrollRun.status',
            label: t('payrollStatus'),
            kind: 'status',
            render: (_: unknown, row: PayrollProfileItem) => <Badge {...payrollBadgeProps(row, t, payrollRunStatusMap)} size="sm" />,
          },
          {
            key: 'notes',
            label: t('invoiceNotesColumn'),
            size: 'name',
            render: (value: unknown) => (
              <span className="nx-cell-ellipsis text-[11px]" title={String(value || '')}>
                {String(value || '-')}
              </span>
            ),
          },
        ]}
        data={payrollItems}
        total={payrollItems.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: PayrollProfileItem) => (
          <div>
            <div className="nx-cr__line1">
              <span className="nx-cr__id">{row.payrollRun?.runNumber ?? '-'}</span>
              <span className="nx-cr__sub">{formatSaudiDate(row.payrollRun?.payrollMonth || '')}</span>
              <Badge {...payrollBadgeProps(row, t, payrollRunStatusMap)} size="sm" />
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">
                <span className="nx-cr__meta">{t('grossSalary')}: <FmtNum n={Number(row.grossSalary ?? 0)} /></span>
              </div>
              <div className="nx-cr__line2-end">
                <span className="nx-cr__amount text-noorix-green"><FmtNum n={Number(row.netSalary ?? 0)} /> <span className="nx-sar">SR</span></span>
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: PayrollProfileItem) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge {...payrollBadgeProps(row, t, payrollRunStatusMap)} size="sm" />
              <span className="text-[12px] text-noorix-muted">{formatSaudiDate(row.payrollRun?.payrollMonth || '')}</span>
            </div>
            <div className="nx-mc__grid nx-mc__grid--3">
              <div><div className="nx-mc__stat-label">{t('payrollRunNumber')}</div><div className="nx-cell-num text-[13px] font-bold ltr">{row.payrollRun?.runNumber ?? '-'}</div></div>
              <div><div className="nx-mc__stat-label">{t('grossSalary')}</div><div className="text-[13px] font-semibold ltr"><FmtNum n={Number(row.grossSalary ?? 0)} /></div></div>
              <div><div className="nx-mc__stat-label">{t('netSalary')}</div><div className="text-[14px] font-bold text-noorix-green ltr"><FmtNum n={Number(row.netSalary ?? 0)} /></div></div>
              <div><div className="nx-mc__stat-label">{t('payrollDeductions')}</div><div className={Number(row.deductions) > 0 ? 'text-[12px] font-semibold ltr text-noorix-red' : 'text-[12px] font-semibold ltr'}>{hrFmt(Number(row.deductions ?? 0))}</div></div>
              <div><div className="nx-mc__stat-label">{t('payrollAdvances')}</div><div className={Number(row.advancesDeduct) > 0 ? 'text-[12px] font-semibold ltr text-noorix-amber' : 'text-[12px] font-semibold ltr'}>{hrFmt(Number(row.advancesDeduct ?? 0))}</div></div>
            </div>
            <div>
              <div className="nx-mc__stat-label">{t('invoiceNotesColumn')}</div>
              <div className="text-[12px] text-noorix-muted break-words">{row.notes || '-'}</div>
            </div>
          </div>
        )}
      />
    </div>
  );
}

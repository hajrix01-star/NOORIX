import { formatSaudiDate } from '../../../../utils/saudiDate';
import { hrFmt } from '../../utils/hrFmt';
import { Badge, FmtNum, SmartTable } from '../../../../ui';

type HrAny = ReturnType<typeof JSON.parse>;

export function EmployeeProfilePayrollSection({ t, payrollItems, payrollRunStatusMap }: HrAny) {
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
            width: '14%',
            render: (_: HrAny, row: HrAny) => (
              <span className="nx-cell-num nx-cell-accent text-[12px]">{row.payrollRun?.runNumber || '—'}</span>
            ),
          },
          {
            key: 'payrollRun.payrollMonth',
            label: t('payrollMonth'),
            width: '14%',
            render: (_: HrAny, row: HrAny) => (
              <span className="nx-cell-muted-sm">{formatSaudiDate(row.payrollRun?.payrollMonth)}</span>
            ),
          },
          {
            key: 'grossSalary',
            label: t('grossSalary'),
            numeric: true,
            width: '12%',
            render: (v: HrAny) => <FmtNum n={v} className="nx-cell-num" />,
          },
          {
            key: 'deductions',
            label: t('payrollDeductions'),
            numeric: true,
            width: '11%',
            render: (v: HrAny) => (
              <span className={Number(v) > 0 ? 'nx-cell-num text-noorix-red' : 'nx-cell-num'}>
                {hrFmt(v)}
              </span>
            ),
          },
          {
            key: 'advancesDeduct',
            label: t('payrollAdvances'),
            numeric: true,
            width: '11%',
            render: (v: HrAny) => (
              <span className={Number(v) > 0 ? 'nx-cell-num text-noorix-amber' : 'nx-cell-num'}>
                {hrFmt(v)}
              </span>
            ),
          },
          {
            key: 'netSalary',
            label: t('netSalary'),
            numeric: true,
            width: '12%',
            render: (v: HrAny) => <FmtNum n={v} className="nx-cell-num font-bold text-noorix-green" />,
          },
          {
            key: 'payrollRun.status',
            label: t('payrollStatus'),
            width: '12%',
            render: (_: HrAny, row: HrAny) => {
              const pr = row.payrollRun;
              const st = String(pr?.status || '').toLowerCase();
              const badgeProps =
                st === 'completed' && pr?.issuedSalaryInvoiceNumber
                  ? { color: 'green', children: t('payrollPaid') }
                  : Badge.fromStatus(pr?.status, payrollRunStatusMap);
              return <Badge {...badgeProps} size="sm" />;
            },
          },
          {
            key: 'notes',
            label: t('invoiceNotesColumn'),
            width: '14%',
            render: (v: HrAny) => (
              <span className="nx-cell-ellipsis text-[11px]" title={v || ''}>
                {v || '—'}
              </span>
            ),
          },
        ]}
        data={payrollItems}
        total={payrollItems.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: HrAny) => {
          const pr = row.payrollRun;
          const stPr = String(pr?.status || '').toLowerCase();
          const payrollBadgeProps =
            stPr === 'completed' && pr?.issuedSalaryInvoiceNumber
              ? { color: 'green' as const, children: t('payrollPaid') }
              : Badge.fromStatus(pr?.status, payrollRunStatusMap);
          return (
            <div>
              <div className="nx-cr__line1">
                <span className="nx-cr__id">{pr?.runNumber ?? '—'}</span>
                <span className="nx-cr__sub">{formatSaudiDate(pr?.payrollMonth)}</span>
                <Badge {...payrollBadgeProps} size="sm" />
              </div>
              <div className="nx-cr__line2">
                <div className="nx-cr__line2-start">
                  <span className="nx-cr__meta">{t('grossSalary')}: <FmtNum n={row.grossSalary} /></span>
                </div>
                <div className="nx-cr__line2-end">
                  <span className="nx-cr__amount text-noorix-green"><FmtNum n={row.netSalary} /> <span className="nx-sar">SR</span></span>
                </div>
              </div>
            </div>
          );
        }}
        renderMobileCard={(row: HrAny) => {
          const pr = row.payrollRun;
          const stPr = String(pr?.status || '').toLowerCase();
          const payrollBadgeProps =
            stPr === 'completed' && pr?.issuedSalaryInvoiceNumber
              ? { color: 'green', children: t('payrollPaid') }
              : Badge.fromStatus(pr?.status, payrollRunStatusMap);
          return (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge {...payrollBadgeProps} size="sm" />
                <span className="text-[12px] text-noorix-muted">
                  {formatSaudiDate(row.payrollRun?.payrollMonth)}
                </span>
              </div>
              <div className="nx-mc__grid nx-mc__grid--3">
                <div>
                  <div className="nx-mc__stat-label">{t('payrollRunNumber')}</div>
                  <div className="nx-cell-num text-[13px] font-bold ltr">
                    {row.payrollRun?.runNumber ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="nx-mc__stat-label">{t('grossSalary')}</div>
                  <div className="text-[13px] font-semibold ltr">
                    <FmtNum n={row.grossSalary} />
                  </div>
                </div>
                <div>
                  <div className="nx-mc__stat-label">{t('netSalary')}</div>
                  <div className="text-[14px] font-bold text-noorix-green ltr">
                    <FmtNum n={row.netSalary} />
                  </div>
                </div>
                <div>
                  <div className="nx-mc__stat-label">{t('payrollDeductions')}</div>
                  <div className={Number(row.deductions) > 0 ? 'text-[12px] font-semibold ltr text-noorix-red' : 'text-[12px] font-semibold ltr'}>
                    {hrFmt(row.deductions)}
                  </div>
                </div>
                <div>
                  <div className="nx-mc__stat-label">{t('payrollAdvances')}</div>
                  <div className={Number(row.advancesDeduct) > 0 ? 'text-[12px] font-semibold ltr text-noorix-amber' : 'text-[12px] font-semibold ltr'}>
                    {hrFmt(row.advancesDeduct)}
                  </div>
                </div>
              </div>
              <div>
                <div className="nx-mc__stat-label">{t('invoiceNotesColumn')}</div>
                <div className="text-[12px] text-noorix-muted break-words">{row.notes || '—'}</div>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}

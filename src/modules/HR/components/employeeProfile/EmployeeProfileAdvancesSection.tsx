import { formatSaudiDate } from '../../../../utils/saudiDate';
import { sumAmounts } from '../../../../utils/format';
import { hrFmt } from '../../utils/hrFmt';
import { Badge, FmtNum, SmartTable } from '../../../../ui';

export function EmployeeProfileAdvancesSection({ t, advances, advanceStatusMap }: any) {
  const activeAdvances = (advances || []).filter((row: any) => row.status !== 'cancelled');
  const totalAmount = sumAmounts(activeAdvances, 'totalAmount');
  const settledTotal = sumAmounts(activeAdvances, 'settledAmountNum');
  const remainingTotal = sumAmounts(activeAdvances, 'remainingAmount');

  return (
    <div className="noorix-surface-card overflow-hidden">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('advancesList')}</span>
      </div>
      <SmartTable
        compact
        showRowNumbers
        rowNumberWidth="1%"
        innerPadding={8}
        columns={[
          {
            key: 'totalAmount',
            label: t('advanceAmount'),
            numeric: true,
            width: '13%',
            render: (v: any) => <FmtNum n={v} className="nx-cell-num nx-cell-bold" />,
          },
          {
            key: 'transactionDate',
            label: t('transactionDate'),
            width: '13%',
            render: (v: any) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>,
          },
          {
            key: 'settledAmount',
            label: t('advanceSettledAmount'),
            numeric: true,
            width: '13%',
            render: (_: any, row: any) => <FmtNum n={row.settledAmountNum || 0} className="nx-cell-num" />,
          },
          {
            key: 'remainingAmount',
            label: t('advanceRemainingAmount'),
            numeric: true,
            width: '13%',
            render: (_: any, row: any) => (
              <span className={row.remainingAmount > 0 ? 'nx-cell-num text-noorix-amber' : 'nx-cell-num text-noorix-green'}>
                {hrFmt(row.remainingAmount || 0)}
              </span>
            ),
          },
          {
            key: 'installmentCount',
            label: t('installmentInfo'),
            width: '13%',
            render: (_: any, row: any) => {
              if (!row.installmentCount || row.installmentCount <= 1) {
                return <span className="nx-cell-muted-sm">—</span>;
              }
              return (
                <span className="text-[12px] text-noorix-blue font-semibold ltr">
                  {row.installmentCount} × {hrFmt(row.installmentAmount ?? 0)}
                </span>
              );
            },
          },
          {
            key: 'status',
            label: t('status'),
            width: '13%',
            render: (_: any, row: any) => <Badge {...Badge.fromStatus(row.settlementStatus, advanceStatusMap)} size="sm" />,
          },
          {
            key: 'notes',
            label: t('invoiceNotesColumn'),
            width: '22%',
            render: (v: any) => (
              <span className="nx-cell-ellipsis" title={v || ''}>
                {v || '—'}
              </span>
            ),
          },
        ]}
        data={advances}
        total={advances.length}
        page={1}
        pageSize={50}
        footerRow={[
          {
            keys: ['totalAmount'],
            className: 'text-[13px] text-end py-1.5 px-3 text-noorix-blue font-black nx-font-numbers',
            content: hrFmt(totalAmount.toNumber()),
          },
          {
            keys: ['transactionDate'],
            className: 'text-[12px] text-noorix-muted py-1.5 px-3',
            content: null,
          },
          {
            keys: ['settledAmount'],
            className: 'text-[13px] text-end py-1.5 px-3 text-noorix-green font-black nx-font-numbers',
            content: hrFmt(settledTotal.toNumber()),
          },
          {
            keys: ['remainingAmount'],
            className: 'text-[13px] text-end py-1.5 px-3 text-noorix-amber font-black nx-font-numbers',
            content: hrFmt(remainingTotal.toNumber()),
          },
        ]}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: any) => (
          <div>
            <div className="nx-cr__line1">
              <span className={row.remainingAmount > 0 ? 'nx-cr__amount text-noorix-amber' : 'nx-cr__amount text-noorix-green'}>
                <FmtNum n={row.remainingAmount || 0} /> <span className="nx-sar">SR</span>
              </span>
              <Badge {...Badge.fromStatus(row.settlementStatus, advanceStatusMap)} size="sm" />
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">
                <span className="nx-cr__meta">{formatSaudiDate(row.transactionDate)}</span>
                {row.installmentCount > 1 && (
                  <span className="nx-cr__meta text-noorix-blue ltr">{row.installmentCount} × {hrFmt(row.installmentAmount ?? 0)}</span>
                )}
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: any) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={row.remainingAmount > 0 ? 'text-[15px] font-bold text-noorix-amber ltr' : 'text-[15px] font-bold text-noorix-green ltr'}>
                <FmtNum n={row.remainingAmount || 0} />
              </span>
              <Badge {...Badge.fromStatus(row.settlementStatus, advanceStatusMap)} size="sm" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="nx-mc__stat-label">{t('advanceAmount')}</div>
                <div className="nx-mc__stat-value">{hrFmt(row.totalAmountNum ?? row.totalAmount)}</div>
              </div>
              <div>
                <div className="nx-mc__stat-label">{t('advanceSettledAmount')}</div>
                <div className="nx-mc__stat-value text-noorix-green">{hrFmt(row.settledAmountNum || 0)}</div>
              </div>
              <div>
                <div className="nx-mc__stat-label">{t('advanceRemainingAmount')}</div>
                <div className={row.remainingAmount > 0 ? 'nx-mc__stat-value text-noorix-amber' : 'nx-mc__stat-value text-noorix-green'}>
                  {hrFmt(row.remainingAmount || 0)}
                </div>
              </div>
            </div>
            <div className="text-[11px] text-noorix-muted text-end">
              {formatSaudiDate(row.transactionDate)}
            </div>
            {row.installmentCount > 1 ? (
              <div className="text-[12px] font-semibold text-noorix-blue ltr">
                {row.installmentCount} × {hrFmt(row.installmentAmount ?? 0)}
              </div>
            ) : null}
            <div>
              <div className="nx-mc__stat-label">{t('invoiceNotesColumn')}</div>
              <div className="text-[12px] text-noorix-text break-words">{row.notes || '—'}</div>
            </div>
          </div>
        )}
      />
    </div>
  );
}

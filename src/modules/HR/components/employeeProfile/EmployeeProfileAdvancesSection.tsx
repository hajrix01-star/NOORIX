import { formatSaudiDate } from '../../../../utils/saudiDate';
import { hrFmt } from '../../utils/hrFmt';
import { Badge, FmtNum, SmartTable } from '../../../../ui';

export function EmployeeProfileAdvancesSection({ t, advances, advanceStatusMap }: any) {
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
            width: '18%',
            render: (v: any) => <FmtNum n={v} className="nx-cell-num nx-cell-bold" />,
          },
          {
            key: 'transactionDate',
            label: t('transactionDate'),
            width: '16%',
            render: (v: any) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>,
          },
          {
            key: 'installmentCount',
            label: t('installmentInfo'),
            width: '20%',
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
            width: '16%',
            render: (v: any) => <Badge {...Badge.fromStatus(v, advanceStatusMap)} size="sm" />,
          },
          {
            key: 'notes',
            label: t('invoiceNotesColumn'),
            width: '30%',
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
        emptyMessage={t('noDataInPeriod')}
        renderMobileCard={(row: any) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[15px] font-bold text-noorix-green ltr">
                <FmtNum n={row.totalAmount} />
              </span>
              <Badge {...Badge.fromStatus(row.status, advanceStatusMap)} size="sm" />
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

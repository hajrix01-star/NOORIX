import { formatSaudiDate } from '../../../../utils/saudiDate';
import { hrFmt } from '../../utils/hrFmt';
import { cn, SmartTable } from '../../../../ui';

export function EmployeeProfileFinancialSection({ t, financialRecords }: any) {
  return (
    <div className="noorix-surface-card overflow-hidden employee-profile-layout__wide">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('financialRecord') || 'السجل المالي'}</span>
      </div>
      <SmartTable
        compact
        showRowNumbers
        rowNumberWidth="1%"
        innerPadding={8}
        columns={[
          {
            key: 'date',
            label: t('transactionDate'),
            width: '12%',
            render: (v: any) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>,
          },
          { key: 'typeLabel', label: t('operationType'), width: '18%', render: (v: any) => v },
          {
            key: 'amount',
            label: t('advanceAmount') || 'المبلغ',
            numeric: true,
            width: '15%',
            render: (v: any) => (
              <span className={`nx-cell-num${v < 0 ? ' nx-cell-num--red' : ''}`}>{hrFmt(v)}</span>
            ),
          },
          {
            key: 'notes',
            label: t('invoiceNotesColumn'),
            width: '54%',
            render: (v: any) => (
              <span className="nx-cell-ellipsis" title={v || ''}>
                {v || '—'}
              </span>
            ),
          },
        ]}
        data={financialRecords}
        total={financialRecords.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: any) => (
          <div>
            <div className="nx-cr__line1">
              <span className="nx-cr__name">{row.typeLabel}</span>
              <span className="nx-cr__meta">{formatSaudiDate(row.date)}</span>
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">
                {row.notes && <span className="nx-cr__sub">{row.notes}</span>}
              </div>
              <div className="nx-cr__line2-end">
                <span className="nx-cr__amount" style={{ color: row.amount < 0 ? 'var(--noorix-accent-red)' : undefined }}>{hrFmt(row.amount)} <span className="nx-sar">SR</span></span>
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: any) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-noorix-muted">{formatSaudiDate(row.date)}</span>
              <span className="text-[13px] font-semibold text-noorix-text">{row.typeLabel}</span>
            </div>
            <div className="nx-mc__grid nx-mc__grid--2">
              <div>
                <div className="nx-mc__stat-label">{t('advanceAmount')}</div>
                <div
                  className={cn('text-[15px] font-bold ltr', row.amount < 0 && 'text-noorix-red')}
                >
                  {hrFmt(row.amount)}
                </div>
              </div>
            </div>
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

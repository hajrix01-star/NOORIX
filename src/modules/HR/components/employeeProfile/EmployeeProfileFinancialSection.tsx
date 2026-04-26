import { formatSaudiDate } from '../../../../utils/saudiDate';
import { hrFmt } from '../../utils/hrFmt';
import { cn, SmartTable } from '../../../../ui';

export function EmployeeProfileFinancialSection({ t, financialRecords }) {
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
            render: (v) => <span className="nx-cell-muted-sm">{formatSaudiDate(v)}</span>,
          },
          { key: 'typeLabel', label: t('operationType'), width: '18%', render: (v) => v },
          {
            key: 'amount',
            label: t('advanceAmount') || 'المبلغ',
            numeric: true,
            width: '15%',
            render: (v) => (
              <span className={`nx-cell-num${v < 0 ? ' nx-cell-num--red' : ''}`}>{hrFmt(v)}</span>
            ),
          },
          {
            key: 'notes',
            label: t('invoiceNotesColumn'),
            width: '54%',
            render: (v) => (
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
        renderMobileCard={(row) => (
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

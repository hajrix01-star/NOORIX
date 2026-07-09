import { formatSaudiDate } from '../../../../utils/saudiDate';
import { hrFmt } from '../../utils/hrFmt';
import { Button, SmartTable, cn } from '../../../../ui';
import type { FinancialRecordRow, ProfileRecord } from './employeeProfileModel';

type TranslationFn = (key: string, ...args: unknown[]) => string;

type EmployeeProfileFinancialSectionProps = {
  t: TranslationFn;
  financialRecords: FinancialRecordRow[];
  onOpenResidency?: (rowOrId: string | ProfileRecord) => void;
};

export function EmployeeProfileFinancialSection({
  t,
  financialRecords,
  onOpenResidency,
}: EmployeeProfileFinancialSectionProps) {
  const openRow = (row: FinancialRecordRow) => {
    if (row.residencyId && onOpenResidency) onOpenResidency(row.residencyId);
  };

  return (
    <div className="noorix-surface-card overflow-hidden employee-profile-layout__wide">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('financialRecord') || 'Financial record'}</span>
      </div>
      <SmartTable
        compact
        showRowNumbers
        innerPadding={8}
        columns={[
          {
            key: 'date',
            label: t('transactionDate'),
            size: 'date',
            render: (value: unknown, row: FinancialRecordRow) => (
              <Button
                variant="raw"
                type="button"
                className={cn(
                  'nx-cell-muted-sm bg-transparent border-0 p-0 text-start',
                  row.residencyId && 'text-noorix-blue hover:underline cursor-pointer',
                )}
                disabled={!row.residencyId}
                onClick={() => openRow(row)}
              >
                {formatSaudiDate(String(value || ''))}
              </Button>
            ),
          },
          {
            key: 'typeLabel',
            label: t('operationType'),
            size: 'supplier',
            render: (value: unknown, row: FinancialRecordRow) => (
              <Button
                variant="raw"
                type="button"
                className={cn('bg-transparent border-0 p-0 text-start', row.residencyId && 'text-noorix-blue hover:underline cursor-pointer')}
                disabled={!row.residencyId}
                onClick={() => openRow(row)}
              >
                {String(value || '-')}
              </Button>
            ),
          },
          {
            key: 'amount',
            label: t('advanceAmount') || 'Amount',
            numeric: true,
            size: 'money-md',
            render: (value: unknown) => (
              <span className={`nx-cell-num${Number(value) < 0 ? ' nx-cell-num--red' : ''}`}>{hrFmt(Number(value ?? 0))}</span>
            ),
          },
          {
            key: 'notes',
            label: t('invoiceNotesColumn'),
            size: 'name',
            render: (value: unknown, row: FinancialRecordRow) => (
              <Button
                variant="raw"
                type="button"
                className={cn(
                  'nx-cell-ellipsis bg-transparent border-0 p-0 text-start w-full',
                  row.residencyId && 'text-noorix-blue hover:underline cursor-pointer',
                )}
                title={String(value || '')}
                disabled={!row.residencyId}
                onClick={() => openRow(row)}
              >
                {String(value || '-')}
              </Button>
            ),
          },
        ]}
        data={financialRecords}
        total={financialRecords.length}
        page={1}
        pageSize={50}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: FinancialRecordRow) => (
          <div
            className={cn(row.residencyId && 'cursor-pointer')}
            onClick={row.residencyId ? () => openRow(row) : undefined}
            role={row.residencyId ? 'button' : undefined}
            tabIndex={row.residencyId ? 0 : undefined}
          >
            <div className="nx-cr__line1">
              <span className={cn('nx-cr__name', row.residencyId && 'text-noorix-blue')}>{row.typeLabel}</span>
              <span className="nx-cr__meta">{formatSaudiDate(row.date)}</span>
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">{row.notes ? <span className="nx-cr__sub">{row.notes}</span> : null}</div>
              <div className="nx-cr__line2-end">
                <span className={`nx-cr__amount ${row.amount < 0 ? 'text-noorix-red' : ''}`}>
                  {hrFmt(row.amount)} <span className="nx-sar">SR</span>
                </span>
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: FinancialRecordRow) => (
          <div
            className={cn('flex flex-col gap-2', row.residencyId && 'cursor-pointer')}
            onClick={row.residencyId ? () => openRow(row) : undefined}
            role={row.residencyId ? 'button' : undefined}
            tabIndex={row.residencyId ? 0 : undefined}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-noorix-muted">{formatSaudiDate(row.date)}</span>
              <span className={cn('text-[13px] font-semibold', row.residencyId ? 'text-noorix-blue' : 'text-noorix-text')}>{row.typeLabel}</span>
            </div>
            <div className="nx-mc__grid nx-mc__grid--2">
              <div>
                <div className="nx-mc__stat-label">{t('advanceAmount')}</div>
                <div className={cn('text-[15px] font-bold ltr', row.amount < 0 && 'text-noorix-red')}>{hrFmt(row.amount)}</div>
              </div>
            </div>
            <div>
              <div className="nx-mc__stat-label">{t('invoiceNotesColumn')}</div>
              <div className="text-[12px] text-noorix-text break-words">{row.notes || '-'}</div>
            </div>
          </div>
        )}
      />
    </div>
  );
}

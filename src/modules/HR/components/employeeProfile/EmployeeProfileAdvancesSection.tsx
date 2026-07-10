import { formatSaudiDate } from '../../../../utils/saudiDate';
import { hrFmt } from '../../utils/hrFmt';
import { Badge, FmtNum, SmartTable } from '../../../../ui';
import { getAdvanceTotals } from '../../utils/advanceBalance';
import { buildAdvanceFinancialFooterRow } from '../../utils/advanceTableFooter';
import type { AdvanceProfileRow } from './employeeProfileModel';

type TranslationFn = (key: string, ...args: unknown[]) => string;

type EmployeeProfileAdvancesSectionProps = {
  t: TranslationFn;
  advances: AdvanceProfileRow[];
  advanceStatusMap: Record<string, unknown>;
};

export function EmployeeProfileAdvancesSection({ t, advances, advanceStatusMap }: EmployeeProfileAdvancesSectionProps) {
  const advanceTotals = getAdvanceTotals(advances);

  return (
    <div className="noorix-surface-card overflow-hidden">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('advancesList')}</span>
      </div>
      <SmartTable
        compact
        showRowNumbers
        innerPadding={8}
        columns={[
          { key: 'totalAmount', label: t('advanceAmount'), numeric: true, size: 'money-md', render: (value: unknown) => <FmtNum n={Number(value ?? 0)} className="nx-cell-num nx-cell-bold" /> },
          { key: 'transactionDate', label: t('transactionDate'), size: 'date', render: (value: unknown) => <span className="nx-cell-muted-sm">{formatSaudiDate(String(value || ''))}</span> },
          { key: 'settledAmount', label: t('advanceSettledAmount'), numeric: true, size: 'money-md', render: (_: unknown, row: AdvanceProfileRow) => <FmtNum n={row.settledAmountNum || 0} className="nx-cell-num" /> },
          {
            key: 'remainingAmount',
            label: t('advanceRemainingAmount'),
            numeric: true,
            size: 'money-md',
            render: (_: unknown, row: AdvanceProfileRow) => (
              <span className={Number(row.remainingAmount ?? 0) > 0 ? 'nx-cell-num text-noorix-amber' : 'nx-cell-num text-noorix-green'}>
                {hrFmt(row.remainingAmount || 0)}
              </span>
            ),
          },
          {
            key: 'installmentCount',
            label: t('installmentInfo'),
            size: 'document',
            render: (_: unknown, row: AdvanceProfileRow) => {
              if (!row.installmentCount || row.installmentCount <= 1) return <span className="nx-cell-muted-sm">-</span>;
              return <span className="text-[12px] text-noorix-blue font-semibold ltr">{row.installmentCount} x {hrFmt(row.installmentAmount ?? 0)}</span>;
            },
          },
          { key: 'status', label: t('status'), kind: 'status', render: (_: unknown, row: AdvanceProfileRow) => <Badge {...Badge.fromStatus(row.settlementStatus, advanceStatusMap)} size="sm" /> },
          {
            key: 'notes',
            label: t('invoiceNotesColumn'),
            size: 'name',
            render: (value: unknown) => (
              <span className="nx-cell-ellipsis" title={String(value || '')}>
                {String(value || '-')}
              </span>
            ),
          },
        ]}
        data={advances}
        total={advances.length}
        page={1}
        pageSize={50}
        footerRow={buildAdvanceFinancialFooterRow({ totals: advanceTotals })}
        emptyMessage={t('noDataInPeriod')}
        renderCompactRow={(row: AdvanceProfileRow) => (
          <div>
            <div className="nx-cr__line1">
              <span className={Number(row.remainingAmount ?? 0) > 0 ? 'nx-cr__amount text-noorix-amber' : 'nx-cr__amount text-noorix-green'}>
                <FmtNum n={row.remainingAmount || 0} /> <span className="nx-sar">SR</span>
              </span>
              <Badge {...Badge.fromStatus(row.settlementStatus, advanceStatusMap)} size="sm" />
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">
                <span className="nx-cr__meta">{formatSaudiDate(row.transactionDate || '')}</span>
                {row.installmentCount && row.installmentCount > 1 ? (
                  <span className="nx-cr__meta text-noorix-blue ltr">{row.installmentCount} x {hrFmt(row.installmentAmount ?? 0)}</span>
                ) : null}
              </div>
            </div>
          </div>
        )}
        renderMobileCard={(row: AdvanceProfileRow) => (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={Number(row.remainingAmount ?? 0) > 0 ? 'text-[15px] font-bold text-noorix-amber ltr' : 'text-[15px] font-bold text-noorix-green ltr'}>
                <FmtNum n={row.remainingAmount || 0} />
              </span>
              <Badge {...Badge.fromStatus(row.settlementStatus, advanceStatusMap)} size="sm" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><div className="nx-mc__stat-label">{t('advanceAmount')}</div><div className="nx-mc__stat-value">{hrFmt(row.totalAmountNum ?? row.totalAmount)}</div></div>
              <div><div className="nx-mc__stat-label">{t('advanceSettledAmount')}</div><div className="nx-mc__stat-value text-noorix-green">{hrFmt(row.settledAmountNum || 0)}</div></div>
              <div><div className="nx-mc__stat-label">{t('advanceRemainingAmount')}</div><div className={Number(row.remainingAmount ?? 0) > 0 ? 'nx-mc__stat-value text-noorix-amber' : 'nx-mc__stat-value text-noorix-green'}>{hrFmt(row.remainingAmount || 0)}</div></div>
            </div>
            <div className="text-[11px] text-noorix-muted text-end">{formatSaudiDate(row.transactionDate || '')}</div>
            {row.installmentCount && row.installmentCount > 1 ? (
              <div className="text-[12px] font-semibold text-noorix-blue ltr">{row.installmentCount} x {hrFmt(row.installmentAmount ?? 0)}</div>
            ) : null}
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

import { Badge, Button, DialogActions, Modal, SimpleTable, cn } from '../../../ui';
import type { BadgeStatusMap } from '../../../ui/Badge';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { hrFmt } from '../utils/hrFmt';
import type { AdvanceGroupRow, AdvanceRow } from '../utils/advanceGrouping';

type TranslationFn = (key: string, ...args: unknown[]) => string;

type AdvanceDetailsModalProps = {
  group: AdvanceGroupRow | null;
  onClose: () => void;
  t: TranslationFn;
  settlementMap: BadgeStatusMap;
  onEditAdvance: (row: AdvanceRow) => void;
  onSettleAdvance: (row: AdvanceRow) => void;
  onDeleteAdvance: (row: AdvanceRow) => void;
};

const isDeductionRow = (row: AdvanceRow) => row.recordType === 'deduction';
const remainingClass = (amount: number) => amount > 0 ? 'text-noorix-amber' : 'text-noorix-green';

function amountValue(row: AdvanceRow) {
  return Number(row.totalAmountNum ?? row.totalAmount ?? 0);
}

function canSettle(row: AdvanceRow) {
  return !isDeductionRow(row) && row.settlementStatus !== 'settled' && row.settlementStatus !== 'cancelled';
}

function textValue(value: unknown, fallback = '-') {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return fallback;
}

function DetailMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'amber' | 'red';
}) {
  return (
    <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/30 px-4 py-3">
      <div className="text-[12px] font-bold text-noorix-muted">{label}</div>
      <div
        dir="ltr"
        className={cn(
          'mt-1 text-[19px] font-black nx-font-numbers text-noorix-text',
          tone === 'green' && 'text-noorix-green',
          tone === 'amber' && 'text-noorix-amber',
          tone === 'red' && 'text-noorix-red',
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function AdvanceDetailsModal({
  group,
  onClose,
  t,
  settlementMap,
  onEditAdvance,
  onSettleAdvance,
  onDeleteAdvance,
}: AdvanceDetailsModalProps) {
  const rows = group?.advances ?? [];
  const deductionAmount = group?.manualDeductionAmount ?? 0;

  return (
    <Modal
      open={!!group}
      onClose={onClose}
      title={group ? `${t('advancesList')} - ${group.employeeName}` : t('advancesList')}
      size="xl"
      footer={(
        <DialogActions
          actions={[
            { key: 'close', label: t('close'), role: 'cancel', onClick: onClose },
          ]}
        />
      )}
    >
      {group ? (
        <div className="grid gap-4">
          <div className="grid gap-2.5 md:grid-cols-4">
            <DetailMetric label={t('advanceAmount')} value={hrFmt(group.totalAmount)} />
            <DetailMetric label={t('advanceSettledAmount')} value={hrFmt(group.settledAmountNum)} tone="green" />
            <DetailMetric label={t('advanceRemainingAmount')} value={hrFmt(group.remainingAmount)} tone={group.remainingAmount > 0 ? 'amber' : 'green'} />
            <DetailMetric label={t('deductionsList')} value={hrFmt(deductionAmount)} tone={deductionAmount > 0 ? 'red' : undefined} />
          </div>

          <SimpleTable<AdvanceRow>
            compact
            tableMinWidth={760}
            frameClassName="shadow-none"
            data={rows}
            emptyMessage={t('noDataInPeriod')}
            columns={[
              {
                key: 'transactionDate',
                label: t('advanceLoanDate'),
                minWidth: 110,
                render: (value) => formatSaudiDate(String(value || '')),
              },
              {
                key: 'recordType',
                label: t('type'),
                minWidth: 110,
                render: (_value, row) => (
                  isDeductionRow(row)
                    ? <Badge color="red" label={t('deductionsList')} size="sm" />
                    : <Badge {...Badge.fromStatus(row.settlementStatus, settlementMap)} size="sm" />
                ),
              },
              {
                key: 'totalAmount',
                label: t('advanceAmount'),
                numeric: true,
                minWidth: 110,
                render: (_value, row) => (
                  <span className={cn('nx-cell-num', isDeductionRow(row) && 'text-noorix-red')}>
                    {isDeductionRow(row) ? '-' : ''}{hrFmt(amountValue(row))}
                  </span>
                ),
              },
              {
                key: 'settledAmountNum',
                label: t('advanceSettledAmount'),
                numeric: true,
                minWidth: 110,
                render: (value) => <span className="nx-cell-num text-noorix-green">{hrFmt(Number(value ?? 0))}</span>,
              },
              {
                key: 'remainingAmount',
                label: t('advanceRemainingAmount'),
                numeric: true,
                minWidth: 110,
                render: (value) => {
                  const remaining = Number(value ?? 0);
                  return <span className={cn('nx-cell-num', remainingClass(remaining))}>{hrFmt(remaining)}</span>;
                },
              },
              {
                key: 'installmentCount',
                label: t('installmentInfo'),
                minWidth: 180,
                render: (_value, row) => {
                  if (isDeductionRow(row)) return textValue(row.notes, t('deductionsList'));
                  const count = Number(row.installmentCount ?? 0);
                  return count > 1 ? `${count} x ${hrFmt(row.installmentAmount ?? 0)}` : '-';
                },
              },
              {
                key: 'settledAt',
                label: t('advanceSettlementDate'),
                minWidth: 110,
                render: (value) => value ? formatSaudiDate(String(value)) : '-',
              },
              {
                key: 'actions',
                label: t('actions'),
                minWidth: 190,
                align: 'center',
                render: (_value, row) => {
                  if (isDeductionRow(row)) return <span className="text-noorix-muted">-</span>;
                  return (
                    <div className="flex items-center justify-center gap-1.5">
                      <Button size="sm" className="h-7 px-2" variant="ghost" onClick={() => onEditAdvance(row)}>{t('edit')}</Button>
                      {canSettle(row) ? (
                        <Button size="sm" className="h-7 px-2" variant="primary" onClick={() => onSettleAdvance(row)}>{t('settleAdvance')}</Button>
                      ) : null}
                      <Button size="sm" className="h-7 px-2" variant="danger" onClick={() => onDeleteAdvance(row)}>{t('delete')}</Button>
                    </div>
                  );
                },
              },
            ]}
          />
        </div>
      ) : null}
    </Modal>
  );
}

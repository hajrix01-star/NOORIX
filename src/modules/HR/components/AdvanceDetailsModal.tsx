import { Badge, Button, DialogActions, Modal, SimpleTable, cn, type SimpleTableColumn } from '../../../ui';
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

type AdvanceLedgerRow = {
  id: string;
  source: 'advance' | 'cut';
  transactionDate: string;
  description: string;
  advanceAmount: number | null;
  repaymentAmount: number | null;
  cutAmount: number | null;
  remainingAmount: number | null;
  installmentInfo: string;
  status: string;
  original: AdvanceRow;
};

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

function signedMoney(value: number | null, tone?: 'green' | 'amber' | 'red') {
  if (value == null || value === 0) return <span className="text-noorix-muted">-</span>;
  return (
    <span
      dir="ltr"
      className={cn(
        'nx-font-numbers font-black text-noorix-text',
        tone === 'green' && 'text-noorix-green',
        tone === 'amber' && 'text-noorix-amber',
        tone === 'red' && 'text-noorix-red',
      )}
    >
      {hrFmt(value)}
    </span>
  );
}

function buildLedgerRows(rows: AdvanceRow[], t: TranslationFn): AdvanceLedgerRow[] {
  return rows
    .map((row, index): AdvanceLedgerRow => {
      const isCut = isDeductionRow(row);
      const amount = amountValue(row);
      const remaining = Number(row.remainingAmount ?? 0);
      const installmentCount = Number(row.installmentCount ?? 0);
      const installmentAmount = Number(row.installmentAmount ?? 0);
      return {
        id: String(row.id || `${isCut ? 'cut' : 'advance'}-${index}`),
        source: isCut ? 'cut' : 'advance',
        transactionDate: String(row.transactionDate || row.settledAt || ''),
        description: isCut
          ? textValue(row.notes, t('payrollCut'))
          : textValue(row.invoiceNumber, t('advanceEntry')),
        advanceAmount: isCut ? null : amount,
        repaymentAmount: isCut ? null : Number(row.settledAmountNum ?? 0),
        cutAmount: isCut ? amount : null,
        remainingAmount: isCut ? null : remaining,
        installmentInfo: !isCut && installmentCount > 1
          ? `${installmentCount} x ${hrFmt(installmentAmount)}`
          : '-',
        status: isCut ? t('payrollCut') : String(row.settlementStatus || ''),
        original: row,
      };
    })
    .sort((a, b) => String(b.transactionDate || '').localeCompare(String(a.transactionDate || '')));
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
  const ledgerRows = buildLedgerRows(rows, t);
  const ledgerColumns: SimpleTableColumn<AdvanceLedgerRow>[] = [
    {
      key: 'transactionDate',
      label: t('transactionDate'),
      width: 110,
      align: 'center',
      render: (value: unknown) => (
        <span className="nx-font-numbers whitespace-nowrap font-bold text-noorix-text">
          {value ? formatSaudiDate(String(value)) : '-'}
        </span>
      ),
    },
    {
      key: 'description',
      label: t('advanceLedgerStatement'),
      minWidth: 180,
      align: 'center',
      render: (value: unknown, row: AdvanceLedgerRow) => (
        <div className="grid gap-1 text-center">
          <Badge
            color={row.source === 'cut' ? 'red' : 'blue'}
            label={row.source === 'cut' ? t('payrollCut') : t('advanceEntry')}
            size="sm"
            className="mx-auto"
          />
          <span className="text-[13px] font-bold text-noorix-text">{textValue(value)}</span>
        </div>
      ),
    },
    {
      key: 'advanceAmount',
      label: t('advanceEntry'),
      numeric: true,
      width: 120,
      align: 'center',
      render: (_: unknown, row: AdvanceLedgerRow) => signedMoney(row.advanceAmount),
    },
    {
      key: 'repaymentAmount',
      label: t('advanceRepayment'),
      numeric: true,
      width: 120,
      align: 'center',
      render: (_: unknown, row: AdvanceLedgerRow) => signedMoney(row.repaymentAmount, 'green'),
    },
    {
      key: 'cutAmount',
      label: t('payrollCut'),
      numeric: true,
      width: 110,
      align: 'center',
      render: (_: unknown, row: AdvanceLedgerRow) => signedMoney(row.cutAmount, 'red'),
    },
    {
      key: 'remainingAmount',
      label: t('advanceRemainingAmount'),
      numeric: true,
      width: 110,
      align: 'center',
      render: (_: unknown, row: AdvanceLedgerRow) => (
        row.remainingAmount == null
          ? <span className="text-noorix-muted">-</span>
          : signedMoney(row.remainingAmount, row.remainingAmount > 0 ? 'amber' : 'green')
      ),
    },
    {
      key: 'installmentInfo',
      label: t('installmentInfo'),
      width: 115,
      align: 'center',
      render: (value: unknown) => <span dir="ltr" className="nx-font-numbers text-[12px] font-bold">{textValue(value)}</span>,
    },
    {
      key: 'status',
      label: t('advanceLedgerStatus'),
      width: 125,
      align: 'center',
      render: (_: unknown, row: AdvanceLedgerRow) => (
        row.source === 'cut'
          ? <Badge color="red" label={t('payrollCut')} size="sm" />
          : <Badge {...Badge.fromStatus(row.original.settlementStatus, settlementMap)} size="sm" />
      ),
    },
    {
      key: 'actions',
      label: t('advanceLedgerActions'),
      width: 165,
      align: 'center',
      render: (_: unknown, row: AdvanceLedgerRow) => (
        row.source === 'cut' ? (
          <span className="text-[12px] font-bold text-noorix-muted">-</span>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-1">
            <Button size="sm" className="h-7 px-2" variant="ghost" onClick={() => onEditAdvance(row.original)}>{t('edit')}</Button>
            {canSettle(row.original) ? (
              <Button size="sm" className="h-7 px-2" variant="success" onClick={() => onSettleAdvance(row.original)}>{t('settleAdvance')}</Button>
            ) : null}
            <Button size="sm" className="h-7 px-2" variant="danger" onClick={() => onDeleteAdvance(row.original)}>{t('delete')}</Button>
          </div>
        )
      ),
    },
  ];

  return (
    <Modal
      open={!!group}
      onClose={onClose}
      title={group ? `${t('advanceLedgerTitle')} - ${group.employeeName}` : t('advanceLedgerTitle')}
      size="2xl"
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
            <DetailMetric label={t('advanceTotalAmount')} value={hrFmt(group.totalAmount)} />
            <DetailMetric label={t('advanceRepayment')} value={hrFmt(group.settledAmountNum)} tone="green" />
            <DetailMetric label={t('advanceRemainingAmount')} value={hrFmt(group.remainingAmount)} tone={group.remainingAmount > 0 ? 'amber' : 'green'} />
            <DetailMetric label={t('payrollCut')} value={hrFmt(deductionAmount)} tone={deductionAmount > 0 ? 'red' : undefined} />
          </div>

          <SimpleTable
            columns={ledgerColumns}
            data={ledgerRows}
            emptyMessage={t('noDataInPeriod')}
            tableMinWidth={900}
            cellPadding="8px 10px"
            frameClassName="shadow-sm"
          />
        </div>
      ) : null}
    </Modal>
  );
}

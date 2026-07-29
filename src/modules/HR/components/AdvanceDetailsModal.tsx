import { Badge, Button, DialogActions, Modal, cn } from '../../../ui';
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

function DetailCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'green' | 'amber' | 'red';
}) {
  return (
    <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/20 px-3 py-2 text-center">
      <div className="text-[11px] font-bold text-noorix-muted">{label}</div>
      <div
        className={cn(
          'mt-1 text-[13px] font-extrabold nx-font-numbers text-noorix-text',
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

function SectionTitle({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-noorix-border pb-2">
      <h3 className="text-[14px] font-black text-noorix-text">{children}</h3>
      <span className="rounded-full bg-noorix-bg-muted px-2.5 py-1 text-[12px] font-extrabold text-noorix-muted">
        {count}
      </span>
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
  const advanceRows = rows.filter((row) => !isDeductionRow(row));
  const deductionRows = rows.filter(isDeductionRow);
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

          <div className="grid gap-4">
            <section className="grid gap-3">
              <SectionTitle count={advanceRows.length}>{t('advancesList')}</SectionTitle>
              {advanceRows.length ? (
                <div className="grid gap-2.5">
                  {advanceRows.map((row, index) => {
                    const remaining = Number(row.remainingAmount ?? 0);
                    const count = Number(row.installmentCount ?? 0);
                    return (
                      <article key={row.id || `advance-${index}`} className="rounded-xl border border-noorix-border bg-noorix-surface px-3 py-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-center">
                          <Badge {...Badge.fromStatus(row.settlementStatus, settlementMap)} size="sm" />
                          <div className="text-[13px] font-extrabold text-noorix-text">{formatSaudiDate(String(row.transactionDate || ''))}</div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-4">
                          <DetailCell label={t('advanceAmount')} value={hrFmt(amountValue(row))} />
                          <DetailCell label={t('advanceSettledAmount')} value={hrFmt(Number(row.settledAmountNum ?? 0))} tone="green" />
                          <DetailCell label={t('advanceRemainingAmount')} value={hrFmt(remaining)} tone={remaining > 0 ? 'amber' : 'green'} />
                          <DetailCell label={t('installmentInfo')} value={count > 1 ? `${count} x ${hrFmt(row.installmentAmount ?? 0)}` : '-'} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                          <Button size="sm" className="h-8 px-3" variant="ghost" onClick={() => onEditAdvance(row)}>{t('edit')}</Button>
                          {canSettle(row) ? (
                            <Button size="sm" className="h-8 px-3" variant="primary" onClick={() => onSettleAdvance(row)}>{t('settleAdvance')}</Button>
                          ) : null}
                          <Button size="sm" className="h-8 px-3" variant="danger" onClick={() => onDeleteAdvance(row)}>{t('delete')}</Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-noorix-border p-5 text-center text-[13px] font-bold text-noorix-muted">
                  {t('noDataInPeriod')}
                </div>
              )}
            </section>

            {deductionRows.length ? (
              <section className="grid gap-3">
                <SectionTitle count={deductionRows.length}>{t('deductionsList')}</SectionTitle>
                <div className="grid gap-2.5">
                  {deductionRows.map((row, index) => (
                    <article key={row.id || `deduction-${index}`} className="rounded-xl border border-noorix-border bg-noorix-bg-muted/20 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-center">
                        <Badge color="red" label={t('deductionsList')} size="sm" />
                        <div className="text-[13px] font-extrabold text-noorix-text">{formatSaudiDate(String(row.transactionDate || ''))}</div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr]">
                        <DetailCell label={t('advanceAmount')} value={`-${hrFmt(amountValue(row))}`} tone="red" />
                        <DetailCell label={t('notes')} value={textValue(row.notes, t('deductionsList'))} />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

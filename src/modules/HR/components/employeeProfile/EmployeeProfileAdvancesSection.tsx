import { useMemo, useState } from 'react';
import { formatSaudiDate } from '../../../../utils/saudiDate';
import { hrFmt } from '../../utils/hrFmt';
import { Badge, Button, DialogActions, FmtNum, Modal, cn } from '../../../../ui';
import { getAdvanceTotals } from '../../utils/advanceBalance';
import type { AdvanceProfileRow } from './employeeProfileModel';

type TranslationFn = (key: string, ...args: unknown[]) => string;

type EmployeeProfileAdvancesSectionProps = {
  t: TranslationFn;
  advances: AdvanceProfileRow[];
  advanceStatusMap: Record<string, unknown>;
};

function valueOf(value: unknown) {
  return Number(value ?? 0);
}

function getAdvanceId(row: AdvanceProfileRow, index: number) {
  return row.id ? String(row.id) : `employee-advance-${index}`;
}

function getInstallmentLabel(row: AdvanceProfileRow) {
  if (!row.installmentCount || row.installmentCount <= 1) return '-';
  return `${row.installmentCount} x ${hrFmt(row.installmentAmount ?? 0)}`;
}

function DetailStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'green' | 'amber';
}) {
  return (
    <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/35 px-3 py-2">
      <div className="text-[11px] font-semibold text-noorix-muted">{label}</div>
      <div
        dir="ltr"
        className={cn(
          'mt-1 text-[15px] font-black nx-font-numbers text-noorix-text',
          tone === 'green' && 'text-noorix-green',
          tone === 'amber' && 'text-noorix-amber',
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function EmployeeProfileAdvancesSection({ t, advances, advanceStatusMap }: EmployeeProfileAdvancesSectionProps) {
  const [selectedAdvance, setSelectedAdvance] = useState<AdvanceProfileRow | null>(null);
  const advanceTotals = getAdvanceTotals(advances);
  const sortedAdvances = useMemo(
    () => [...advances].sort((a, b) => String(b.transactionDate || '').localeCompare(String(a.transactionDate || ''))),
    [advances],
  );
  const selectedRemaining = valueOf(selectedAdvance?.remainingAmount);
  const selectedSettled = valueOf(selectedAdvance?.settledAmountNum ?? selectedAdvance?.settledAmount);

  return (
    <div className="noorix-surface-card overflow-hidden">
      <div className="nx-section-header">
        <span className="nx-section-header__title">{t('advancesList')}</span>
        <Badge color={advanceTotals.remainingAmount.gt(0) ? 'amber' : 'green'} size="sm">
          {advanceTotals.outstandingCount + advanceTotals.partialCount}
        </Badge>
      </div>
      <div className="p-4">
        <div className="grid gap-2.5 md:grid-cols-3">
          <DetailStat label={t('advanceAmount')} value={hrFmt(advanceTotals.totalAmount.toNumber())} />
          <DetailStat label={t('advanceSettledAmount')} value={hrFmt(advanceTotals.settledAmount.toNumber())} tone="green" />
          <DetailStat label={t('advanceRemainingAmount')} value={hrFmt(advanceTotals.remainingAmount.toNumber())} tone={advanceTotals.remainingAmount.gt(0) ? 'amber' : 'green'} />
        </div>

        {sortedAdvances.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-noorix-border bg-noorix-bg-muted/30 p-5 text-center text-[13px] font-semibold text-noorix-muted">
            {t('noDataInPeriod')}
          </div>
        ) : (
          <div className="mt-4 grid gap-2.5">
            {sortedAdvances.map((row, index) => {
              const remaining = valueOf(row.remainingAmount);
              const isOpen = remaining > 0;
              return (
                <Button
                  key={getAdvanceId(row, index)}
                  variant="raw"
                  size="auto"
                  className="w-full rounded-xl border border-noorix-border bg-white px-4 py-3 text-start shadow-[0_1px_8px_rgba(15,23,42,0.05)] hover:border-noorix-green hover:bg-noorix-green/5"
                  onClick={() => setSelectedAdvance(row)}
                >
                  <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-black text-noorix-text">{formatSaudiDate(row.transactionDate || '')}</span>
                        <Badge {...Badge.fromStatus(row.settlementStatus, advanceStatusMap)} size="sm" />
                      </div>
                      <div className="mt-1 max-w-full truncate text-[12px] font-semibold text-noorix-muted">
                        {row.notes || t('invoiceNotesColumn')}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center md:min-w-[320px]">
                      <div>
                        <div className="text-[10px] font-bold text-noorix-muted">{t('advanceAmount')}</div>
                        <div dir="ltr" className="mt-0.5 text-[13px] font-black nx-font-numbers text-noorix-text">
                          <FmtNum n={valueOf(row.totalAmountNum ?? row.totalAmount)} />
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-noorix-muted">{t('advanceSettledAmount')}</div>
                        <div dir="ltr" className="mt-0.5 text-[13px] font-black nx-font-numbers text-noorix-green">
                          <FmtNum n={valueOf(row.settledAmountNum ?? row.settledAmount)} />
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-noorix-muted">{t('advanceRemainingAmount')}</div>
                        <div
                          dir="ltr"
                          className={cn(
                            'mt-0.5 text-[13px] font-black nx-font-numbers',
                            isOpen ? 'text-noorix-amber' : 'text-noorix-green',
                          )}
                        >
                          <FmtNum n={remaining} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={!!selectedAdvance}
        onClose={() => setSelectedAdvance(null)}
        title={t('advancesList')}
        size="md"
        footer={(
          <DialogActions
            actions={[
              { key: 'close', label: t('close'), role: 'cancel', onClick: () => setSelectedAdvance(null) },
            ]}
          />
        )}
      >
        {selectedAdvance ? (
          <div className="grid gap-4">
            <div className="rounded-xl border border-noorix-border bg-noorix-bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[12px] font-semibold text-noorix-muted">{t('advanceRemainingAmount')}</div>
                  <div
                    dir="ltr"
                    className={cn(
                      'mt-1 text-[26px] font-black nx-font-numbers',
                      selectedRemaining > 0 ? 'text-noorix-amber' : 'text-noorix-green',
                    )}
                  >
                    {hrFmt(selectedRemaining)}
                  </div>
                </div>
                <Badge {...Badge.fromStatus(selectedAdvance.settlementStatus, advanceStatusMap)} size="md" />
              </div>
            </div>

            <div className="grid gap-2.5 md:grid-cols-2">
              <DetailStat label={t('advanceAmount')} value={hrFmt(valueOf(selectedAdvance.totalAmountNum ?? selectedAdvance.totalAmount))} />
              <DetailStat label={t('advanceSettledAmount')} value={hrFmt(selectedSettled)} tone="green" />
              <DetailStat label={t('advanceLoanDate')} value={formatSaudiDate(selectedAdvance.transactionDate || '')} />
              <DetailStat label={t('installmentInfo')} value={getInstallmentLabel(selectedAdvance)} />
            </div>

            <div className="rounded-xl border border-noorix-border bg-white p-3">
              <div className="text-[11px] font-bold text-noorix-muted">{t('invoiceNotesColumn')}</div>
              <div className="mt-1 whitespace-pre-wrap text-[13px] font-semibold leading-7 text-noorix-text">
                {selectedAdvance.notes || '-'}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

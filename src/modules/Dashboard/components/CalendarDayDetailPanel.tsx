import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { formatSaudiDate, toYmd } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { Button, Input, FmtNum, SimpleTable } from '../../../ui';
import type { SimpleTableColumn } from '../../../ui';
import type { DashboardSalesSummary } from '../../../types/api/domains/dashboard';
import { dashboardDisplayName } from '../utils/dashboardDisplayName';

type DashboardSalesSummaryRow = DashboardSalesSummary & Record<string, unknown>;

type CalendarDayDetailPanelProps = {
  dateStr: string;
  dayAmount: number;
  dayTarget: number | null;
  summaries: DashboardSalesSummary[];
  companyId: string;
  companyName: string;
  onPrint?: () => void;
  dayNote?: string;
  onSaveNote?: (note: string) => void;
};

export default function CalendarDayDetailPanel({
  dateStr,
  dayAmount,
  dayTarget,
  summaries,
  companyId,
  companyName,
  onPrint,
  dayNote,
  onSaveNote,
}: CalendarDayDetailPanelProps) {
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const company = companies.find((item) => item.id === (companyId || summaries[0]?.companyId));
  const name = dashboardDisplayName(company, lang, companyName);

  const [noteInput, setNoteInput] = useState(dayNote || '');
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    setNoteInput(dayNote || '');
  }, [dateStr, dayNote]);

  const daySummaries = useMemo<DashboardSalesSummaryRow[]>(
    () => summaries.filter((summary) => toYmd(summary.transactionDate) === dateStr),
    [summaries, dateStr],
  );
  const totalAmount = dayAmount;
  const achieved = dayTarget != null && totalAmount >= dayTarget;

  const summaryColumns = useMemo<SimpleTableColumn<DashboardSalesSummaryRow>[]>(
    () => [
      {
        key: 'summaryNumber',
        label: t('summaryNumber'),
        render: (value) => typeof value === 'string' && value.trim() ? value : '-',
      },
      {
        key: 'channels',
        label: t('salesChannels'),
        render: (_value, row) => {
          const channelText = (row.channels ?? [])
            .map((channel) => `${vaultDisplayName(channel.vault, lang)}: ${fmt(channel.amount || 0)}`)
            .join(' | ');
          return (
            <span className="nx-cell-ellipsis" title={channelText || ''}>
              {channelText || '-'}
            </span>
          );
        },
      },
      {
        key: 'customerCount',
        label: t('customers'),
        numeric: true,
        render: (value) => <span className="nx-cell-num">{typeof value === 'number' ? value : 0}</span>,
      },
      {
        key: 'totalAmount',
        label: t('total'),
        numeric: true,
        render: (value) => (
          <span className="nx-cell-num font-semibold text-noorix-green">
            <FmtNum n={Number(value || 0)} />
          </span>
        ),
      },
    ],
    [lang, t],
  );

  const handleBlurNote = async () => {
    const trimmed = noteInput.trim();
    if (!onSaveNote || trimmed === (dayNote || '')) return;
    setIsSavingNote(true);
    try {
      await onSaveNote(trimmed);
    } finally {
      setIsSavingNote(false);
    }
  };

  if (!dateStr) return null;

  return (
    <div className="noorix-surface-card flex min-w-[260px] flex-[0_0_280px] flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h4 className="m-0 text-[15px] font-bold">{formatSaudiDate(dateStr)}</h4>
        {onPrint && (
          <Button variant="primary" onClick={onPrint}>{t('print')}</Button>
        )}
      </div>
      {name && <div className="text-[11px] text-noorix-muted">{name}</div>}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg flex-1 min-w-[90px] p-[10px] bg-[var(--noorix-blue-8)]">
          <div className="text-noorix-muted mb-1 text-[12px]">{t('dashboardSalesTarget')}</div>
          <div className="text-[16px] font-bold nx-font-numbers">{dayTarget != null ? fmt(dayTarget) : '-'}</div>
          <div className="text-[11px] text-noorix-muted mt-0.5"><span className="nx-sar">SR</span></div>
        </div>
        <div className={`rounded-lg flex-1 min-w-[90px] p-[10px] ${achieved ? 'bg-[var(--noorix-green-12)]' : 'bg-noorix-bg-muted'}`}>
          <div className="flex items-center gap-1 text-noorix-muted mb-1">
            <span className="text-[12px]">{t('total')}</span>
            {achieved && <span className="text-[11px] font-bold px-1 rounded bg-noorix-green text-white">✓</span>}
          </div>
          <div className={`text-[16px] font-bold nx-font-numbers ${achieved ? 'text-noorix-green' : 'text-noorix-text'}`}><FmtNum n={totalAmount} /></div>
          <div className="text-[11px] text-noorix-muted mt-0.5"><span className="nx-sar">SR</span></div>
        </div>
      </div>

      <div>
        <Input
          multiline
          label={t('dashboardDayNote')}
          value={noteInput}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setNoteInput(event.target.value)}
          onBlur={() => void handleBlurNote()}
          placeholder={t('dashboardDayNotePlaceholder')}
          rows={2}
        />
        {isSavingNote && <span className="text-[11px] text-noorix-muted">...</span>}
      </div>

      <div className="text-[12px] font-semibold">{t('salesChannels')} / {t('summaryNumber')}</div>
      <div className="flex-1 min-w-0 min-h-[100px]">
        <SimpleTable
          columns={summaryColumns}
          data={daySummaries}
          tableMinWidth={360}
          compact
          emptyMessage={t('noDataInPeriod')}
        />
      </div>
    </div>
  );
}

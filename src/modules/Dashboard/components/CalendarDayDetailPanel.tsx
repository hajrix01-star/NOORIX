/**
 * CalendarDayDetailPanel — تفاصيل مبيعات يوم بجانب التقويم + ملاحظة اليوم
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { formatSaudiDate, toYmd } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { Button, Input, FmtNum, SimpleTable } from '../../../ui';
import type { SimpleTableColumn } from '../../../ui';

export default function CalendarDayDetailPanel({ dateStr, dayAmount, dayTarget, summaries, companyId, companyName, onPrint, dayNote, onSaveNote }: any) {
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const company = companies?.find((c: any) => c.id === (companyId || summaries?.[0]?.companyId));
  const name = lang === 'en' ? (company?.nameEn || company?.nameAr || companyName || '') : (company?.nameAr || company?.nameEn || companyName || '');

  const [noteInput, setNoteInput] = useState(dayNote || '');
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    setNoteInput(dayNote || '');
  }, [dateStr, dayNote]);

  const daySummaries = (summaries || []).filter((s: any) => toYmd(s.transactionDate) === dateStr);
  const totalAmount = daySummaries.reduce((s: any, x: any) => s + Number(x.totalAmount || 0), 0);
  const achieved = dayTarget != null && totalAmount >= dayTarget;
  const summaryColumns = useMemo<SimpleTableColumn<any>[]>(
    () => [
      {
        key: 'summaryNumber',
        label: t('summaryNumber'),
        render: (v: any) => v || '—',
      },
      {
        key: 'channels',
        label: t('salesChannels'),
        render: (_: any, row: any) => {
          const chText = (row.channels || [])
            .map((ch: any) => `${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount || 0)}`)
            .join(' | ');
          return (
            <span className="nx-cell-ellipsis" title={chText || ''}>
              {chText || '—'}
            </span>
          );
        },
      },
      {
        key: 'customerCount',
        kind: 'number',
        label: t('customers'),
        numeric: true,
        render: (v: any) => <span className="nx-cell-num">{v ?? 0}</span>,
      },
      {
        key: 'totalAmount',
        kind: 'money',
        label: t('total'),
        numeric: true,
        render: (v: any) => (
          <span className="nx-cell-num font-semibold text-noorix-green">
            <FmtNum n={Number(v || 0)} />
          </span>
        ),
      },
    ],
    [lang, t],
  );

  const handleBlurNote = () => {
    const trimmed = (noteInput || '').trim();
    if (typeof onSaveNote === 'function' && trimmed !== (dayNote || '')) {
      setIsSavingNote(true);
      onSaveNote(trimmed);
      setTimeout(() => setIsSavingNote(false), 300);
    }
  };

  if (!dateStr) return null;

  return (
    <div className="noorix-surface-card flex min-w-[260px] flex-[0_0_280px] flex-col gap-3 p-4">
      <div className="flex flex items-center justify-between">
        <h4 className="m-0 text-[15px] font-bold">{formatSaudiDate(dateStr)}</h4>
        {onPrint && (
          <Button variant="primary" onClick={onPrint}>{t('print')}</Button>
        )}
      </div>
      <div className="flex flex flex-wrap gap-3">
        <div className="rounded-lg flex-1 min-w-[90px] p-[10px]" style={{ background: 'var(--noorix-blue-8)' }}>
          <div className="text-noorix-muted mb-1 text-[10px]">{t('dashboardSalesTarget')}</div>
          <div className="text-[16px] font-bold" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{dayTarget != null ? fmt(dayTarget) : '—'}</div>
          <div className="text-[9px] text-noorix-muted mt-0.5"><span className="nx-sar">SR</span></div>
        </div>
        <div className="rounded-lg flex-1 min-w-[90px] p-[10px]" style={{ background: achieved ? 'var(--noorix-green-12)' : 'var(--noorix-bg-muted)' }}>
          <div className="flex items-center gap-1 text-noorix-muted mb-1">
            <span className="text-[10px]">{t('total')}</span>
            {achieved && <span className="text-[9px] font-bold px-1 rounded" style={{ background: 'var(--noorix-accent-green)', color: '#fff' }}>✓</span>}
          </div>
          <div className="text-[16px] font-bold" style={{ fontFamily: 'var(--noorix-font-numbers)', color: achieved ? 'var(--noorix-accent-green)' : 'var(--noorix-text)' }}><FmtNum n={totalAmount} /></div>
          <div className="text-[9px] text-noorix-muted mt-0.5"><span className="nx-sar">SR</span></div>
        </div>
      </div>

      {/* ملاحظة اليوم */}
      <div>
        <Input
          multiline
          label={t('dashboardDayNote')}
          value={noteInput}
          onChange={(e: any) => setNoteInput(e.target.value)}
          onBlur={handleBlurNote}
          placeholder={t('dashboardDayNotePlaceholder')}
          rows={2}
        />
        {isSavingNote && <span className="text-[10px] text-noorix-muted">…</span>}
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

/**
 * CalendarDayDetailPanel — تفاصيل مبيعات يوم بجانب التقويم + ملاحظة اليوم
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { Button, Input } from '../../../ui';

export default function CalendarDayDetailPanel({ dateStr, dayAmount, dayTarget, summaries, companyId, companyName, onPrint, dayNote, onSaveNote }) {
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const company = companies?.find((c) => c.id === (companyId || summaries?.[0]?.companyId));
  const name = lang === 'en' ? (company?.nameEn || company?.nameAr || companyName || '') : (company?.nameAr || company?.nameEn || companyName || '');

  const [noteInput, setNoteInput] = useState(dayNote || '');
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    setNoteInput(dayNote || '');
  }, [dateStr, dayNote]);

  const daySummaries = (summaries || []).filter((s) => String(s.transactionDate || '').slice(0, 10) === dateStr);
  const totalAmount = daySummaries.reduce((s, x) => s + Number(x.totalAmount || 0), 0);
  const achieved = dayTarget != null && totalAmount >= dayTarget;

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
          <div className="text-[16px] font-bold" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{dayTarget != null ? fmt(dayTarget, 2) : '—'}</div>
          <div className="text-[9px] text-noorix-muted mt-0.5">SAR</div>
        </div>
        <div className="rounded-lg flex-1 min-w-[90px] p-[10px]" style={{ background: achieved ? 'var(--noorix-green-12)' : 'var(--noorix-bg-muted)' }}>
          <div className="flex items-center gap-1 text-noorix-muted mb-1">
            <span className="text-[10px]">{t('total')}</span>
            {achieved && <span className="text-[9px] font-bold px-1 rounded" style={{ background: 'var(--noorix-accent-green)', color: '#fff' }}>✓</span>}
          </div>
          <div className="text-[16px] font-bold" style={{ fontFamily: 'var(--noorix-font-numbers)', color: achieved ? 'var(--noorix-accent-green)' : 'var(--noorix-text)' }}>{fmt(totalAmount, 2)}</div>
          <div className="text-[9px] text-noorix-muted mt-0.5">SAR</div>
        </div>
      </div>

      {/* ملاحظة اليوم */}
      <div>
        <Input
          multiline
          label={t('dashboardDayNote')}
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          onBlur={handleBlurNote}
          placeholder={t('dashboardDayNotePlaceholder')}
          rows={2}
        />
        {isSavingNote && <span className="text-[10px] text-noorix-muted">…</span>}
      </div>

      <div className="text-[12px] font-semibold">{t('salesChannels')} / {t('summaryNumber')}</div>
      <div className="flex-1 min-w-0 overflow-auto border border-noorix-border rounded-lg min-h-[100px]">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-noorix-bg-muted">
              <th className="py-1.5 px-2 text-right font-bold">{t('summaryNumber')}</th>
              <th className="py-1.5 px-2 text-right font-bold">{t('salesChannels')}</th>
              <th className="py-1.5 px-2 text-right font-bold">{t('customers')}</th>
              <th className="py-1.5 px-2 text-right font-bold">{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {daySummaries.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center text-noorix-muted text-[11px]">{t('noDataInPeriod')}</td></tr>
            ) : daySummaries.map((s) => {
              const chText = (s.channels || []).map((ch) => `${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount || 0, 2)}`).join(' | ');
              return (
                <tr key={s.id} className="border-t border-noorix-border">
                  <td className="py-1.5 px-2">{s.summaryNumber || '—'}</td>
                  <td className="nx-cell-ellipsis py-1.5 px-2" title={chText || ''}>{chText || '—'}</td>
                  <td className="nx-cell-num py-1.5 px-2">{s.customerCount ?? 0}</td>
                  <td className="nx-cell-num font-semibold text-noorix-green py-1.5 px-2">{fmt(Number(s.totalAmount || 0), 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

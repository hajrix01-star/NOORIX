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
    <div className="nx-flex nx-flex-col nx-gap-12 nx-p-16 nx-bg-surface nx-border-all nx-rounded" style={{ flex: '0 0 280px', minWidth: 260 }}>
      <div className="nx-flex nx-flex-between">
        <h4 className="nx-m-0 nx-text-lg nx-font-700">{formatSaudiDate(dateStr)}</h4>
        {onPrint && (
          <Button variant="primary" onClick={onPrint}>{t('print')}</Button>
        )}
      </div>
      <div className="nx-flex nx-flex-wrap nx-gap-12">
        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(37,99,235,0.08)', flex: 1, minWidth: 90 }}>
          <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>{t('dashboardSalesTarget')}</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)' }}>{dayTarget != null ? fmt(dayTarget, 2) : '—'} ﷼</div>
        </div>
        <div style={{ padding: 10, borderRadius: 8, background: achieved ? 'rgba(22,163,74,0.12)' : 'var(--noorix-bg-muted)', flex: 1, minWidth: 90 }}>
          <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>{t('total')}</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--noorix-font-numbers)', color: achieved ? '#16a34a' : 'var(--noorix-text)' }}>{fmt(totalAmount, 2)} ﷼ {achieved && '✓'}</div>
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
        {isSavingNote && <span style={{ fontSize: 10, color: 'var(--noorix-text-muted)' }}>…</span>}
      </div>

      <div className="nx-text-sm nx-font-600">{t('salesChannels')} / {t('summaryNumber')}</div>
      <div className="nx-flex-1 nx-overflow-auto nx-border-all nx-rounded" style={{ minHeight: 100 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--noorix-bg-muted)' }}>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{t('summaryNumber')}</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{t('salesChannels')}</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{t('customers')}</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {daySummaries.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: 'var(--noorix-text-muted)', fontSize: 11 }}>{t('noDataInPeriod')}</td></tr>
            ) : daySummaries.map((s) => {
              const chText = (s.channels || []).map((ch) => `${vaultDisplayName(ch.vault, lang)}: ${fmt(ch.amount || 0, 2)}`).join(' | ');
              return (
                <tr key={s.id} style={{ borderTop: '1px solid var(--noorix-border)' }}>
                  <td style={{ padding: '6px 8px' }}>{s.summaryNumber || '—'}</td>
                  <td className="nx-cell-ellipsis" style={{ padding: '6px 8px' }} title={chText || ''}>{chText || '—'}</td>
                  <td className="nx-cell-num" style={{ padding: '6px 8px' }}>{s.customerCount ?? 0}</td>
                  <td className="nx-cell-num" style={{ padding: '6px 8px', fontWeight: 600, color: '#16a34a' }}>{fmt(Number(s.totalAmount || 0), 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

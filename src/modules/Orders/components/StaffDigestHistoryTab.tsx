/**
 * StaffDigestHistoryTab — سجل إرسالات الكاشير
 */
import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { useDigestHistory } from '../../../hooks/useOrders';
import { Badge, Spinner, Input, Button } from '../../../ui';

type DisplayLang = 'ar' | 'en';

/** بناء نص واتساب من بيانات اليوم */
function buildResendText(day: any, lang: DisplayLang): string {
  const header = lang === 'en'
    ? `🧾 Section Orders — ${day.date}`
    : `🧾 طلبات الأقسام — ${day.date}`;
  const lines: string[] = [header, ''];
  for (const sec of day.sections) {
    lines.push(`*${sec.sectionName}:*`);
    for (const it of sec.items) {
      const name = lang === 'en' ? (it.nameEn || it.nameAr) : (it.nameAr || it.nameEn);
      const unit = it.unit ? ` ${it.unit}` : '';
      lines.push(`• ${name} × ${fmt(it.qty, 0)}${unit}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function DayCard({ day, displayLang }: { day: any; displayLang: DisplayLang }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const totalOrders = day.sections.reduce((sum: number, s: any) => sum + s.ordersCount, 0);

  function itemName(it: any): string {
    return displayLang === 'en' ? (it.nameEn || it.nameAr) : (it.nameAr || it.nameEn);
  }

  function handleResend() {
    const text = buildResendText(day, displayLang);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <div className="noorix-surface-card overflow-hidden">
      {/* رأس البطاقة */}
      <div className="flex items-center justify-between px-4 py-3 gap-2">
        <button
          type="button"
          className="flex items-center gap-3 flex-1 text-start hover:opacity-80 transition-opacity"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="text-[14px] font-bold text-noorix-text nx-font-numbers ltr">{day.date}</span>
          <Badge color="green" size="sm">{totalOrders} {t('staffOrdersCount')}</Badge>
          <span className="text-[12px] text-noorix-muted">{day.sections.length} {t('digestHistorySections')}</span>
          <span className="text-noorix-muted text-[12px] ms-auto">{expanded ? '▲' : '▼'}</span>
        </button>

        {/* زر إعادة الإرسال */}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleResend}
          title={t('digestResend')}
        >
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/>
              <path d="M22 2L15 22 11 13 2 9l20-7z"/>
            </svg>
            {t('digestResend')}
          </span>
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-noorix-border divide-y divide-noorix-border">
          {day.sections.map((sec: any) => (
            <div key={sec.sectionName} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-semibold">{sec.sectionName}</span>
                <Badge color="amber" size="sm">{sec.ordersCount} {t('staffOrdersCount')}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {sec.items.map((it: any, i: number) => {
                  const unit = it.unit ? ` ${it.unit}` : '';
                  return (
                    <div key={i} className="flex justify-between text-[13px]">
                      <span className="text-noorix-muted">{itemName(it)}</span>
                      <span className="font-semibold nx-font-numbers">{fmt(it.qty, 0)}{unit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StaffDigestHistoryTab({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [displayLang, setDisplayLang] = useState<DisplayLang>('ar');
  const { data: history = [], isLoading } = useDigestHistory(companyId, days);

  return (
    <div className="flex flex-col gap-4">
      {/* شريط التحكم */}
      <div className="noorix-surface-card px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-semibold text-noorix-text">{t('digestHistoryTitle')}</span>

        {/* فترة العرض */}
        <Input
          type="select"
          value={String(days)}
          onChange={(e: any) => setDays(Number(e.target.value))}
          className="w-[140px]"
        >
          <option value="7">{t('digestHistoryLast7')}</option>
          <option value="30">{t('digestHistoryLast30')}</option>
          <option value="90">{t('digestHistoryLast90')}</option>
        </Input>

        {/* مبدّل لغة العرض */}
        <div className="inline-flex rounded-lg border border-noorix-border overflow-hidden text-[12px]">
          <button
            type="button"
            className={`px-3 py-1.5 transition-colors ${displayLang === 'ar' ? 'bg-noorix-blue text-white font-bold' : 'bg-noorix-surface text-noorix-muted hover:bg-noorix-bg-muted'}`}
            onClick={() => setDisplayLang('ar')}
          >
            AR
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 transition-colors ${displayLang === 'en' ? 'bg-noorix-blue text-white font-bold' : 'bg-noorix-surface text-noorix-muted hover:bg-noorix-bg-muted'}`}
            onClick={() => setDisplayLang('en')}
          >
            EN
          </button>
        </div>

        <span className="text-[12px] text-noorix-muted ms-auto">
          {(history as any[]).length} {t('digestHistoryDays')}
        </span>
      </div>

      {/* المحتوى */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (history as any[]).length === 0 ? (
        <div className="noorix-surface-card p-10 text-center text-noorix-muted text-[14px]">
          {t('digestHistoryEmpty')}
        </div>
      ) : (
        (history as any[]).map((day: any) => (
          <DayCard key={day.date} day={day} displayLang={displayLang} />
        ))
      )}
    </div>
  );
}

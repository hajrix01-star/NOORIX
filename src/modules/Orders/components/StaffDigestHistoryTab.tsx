/**
 * StaffDigestHistoryTab — سجل إرسالات الكاشير
 */
import React, { useState } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { useDigestHistory } from '../../../hooks/useOrders';
import { Badge, Spinner, Input } from '../../../ui';

type DisplayLang = 'ar' | 'en';

function DayCard({ day, displayLang }: { day: any; displayLang: DisplayLang }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const totalItems = day.sections.reduce((sum: number, s: any) => sum + s.items.length, 0);
  const totalOrders = day.sections.reduce((sum: number, s: any) => sum + s.ordersCount, 0);

  function itemName(it: any): string {
    return displayLang === 'en' ? (it.nameEn || it.nameAr) : (it.nameAr || it.nameEn);
  }

  return (
    <div className="noorix-surface-card overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-noorix-bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-bold text-noorix-text nx-font-numbers ltr">{day.date}</span>
          <Badge color="green" size="sm">{totalOrders} {t('staffOrdersCount')}</Badge>
          <span className="text-[12px] text-noorix-muted">{day.sections.length} {t('digestHistorySections')}</span>
        </div>
        <span className="text-noorix-muted text-[12px]">{expanded ? '▲' : '▼'}</span>
      </button>

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

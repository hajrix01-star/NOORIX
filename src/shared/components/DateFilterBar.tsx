/**
 * DateFilterBar — شريط فلترة التواريخ المركزي
 * يدعم: اختيار شهر / يوم محدد / نطاق تاريخين
 * يرسل startDate/endDate كـ ISO strings بالمنطقة الزمنية السعودية (UTC+3)
 */
import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../hooks/useDateFilter';
import { Input, Button } from '../../ui';
import { getSaudiNow } from '../../utils/saudiDate';

export { useDateFilter };

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function ymd(y: any, m: any, d: any) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ——— مكوّن الواجهة ———

export default function DateFilterBar({ filter }: any) {
  const { t, lang } = useTranslation();
  const MODES = [
    { id: 'all',   label: t('dateFilterAll') },
    { id: 'month', label: t('dateFilterMonth') },
    { id: 'day',   label: t('dateFilterDay') },
    { id: 'range', label: t('dateFilterRange') },
  ];
  const {
    mode, setMode,
    selYear, setSelYear,
    selMonth, setSelMonth,
    selDay, setSelDay,
    rangeStart, setRangeStart,
    rangeEnd, setRangeEnd,
    reset,
    label,
  } = filter;

  const now = getSaudiNow();
  // سنوات متاحة للاختيار (العام الحالي والعام الماضي)
  const years = [now.year - 1, now.year];

  return (
    <div className="noorix-date-filter-bar" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* مجموعة أزرار الوضع — raw لتفادي حدود/زوايا nx-btn فوق بعضها */}
      <div className="ndfb-mode-group">
        {MODES.map((m: any) => (
          <Button
            key={m.id}
            variant="raw"
            type="button"
            className={`ndfb-mode-btn${mode === m.id ? ' ndfb-mode-btn--active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </Button>
        ))}
      </div>

      {/* وضع الشهر: السنة+الشهر كعنصرَي flex مباشرَين (بدون غلاف يتمدد) + dir=ltr لأسهم select الإنجليزية */}
      {mode === 'month' && (
        <span className="ndfb-date-selects" dir="ltr">
          <Input
            type="select"
            className="ndfb-year-select"
            value={selYear}
            onChange={(e: any) => setSelYear(Number(e.target.value))}
          >
            {years.map((y: any) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Input>
          <Input
            type="select"
            className="ndfb-month-select"
            value={selMonth}
            onChange={(e: any) => setSelMonth(Number(e.target.value))}
          >
            {MONTH_NAMES_EN.map((name: any, i: any) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </Input>
        </span>
      )}

      {/* حقول الفلتر — يوم / نطاق فقط */}
      {(mode === 'day' || mode === 'range') && (
      <div className="ndfb-fields">
        {mode === 'day' && (
          <Input
            type="date"
            value={selDay}
            max={ymd(now.year, now.month, now.day)}
            onChange={(e: any) => setSelDay(e.target.value)}
          />
        )}

        {mode === 'range' && (
          <>
            <div className="flex flex items-center gap-1.5">
              <span className="text-[11px] text-noorix-muted whitespace-nowrap">{t('dateFilterFrom')}</span>
              <Input
                type="date"
                value={rangeStart}
                onChange={(e: any) => setRangeStart(e.target.value)}
              />
            </div>
            <div className="flex flex items-center gap-1.5">
              <span className="text-[11px] text-noorix-muted whitespace-nowrap">{t('dateFilterTo')}</span>
              <Input
                type="date"
                value={rangeEnd}
                min={rangeStart}
                onChange={(e: any) => setRangeEnd(e.target.value)}
              />
            </div>
          </>
        )}
      </div>
      )}

      {/* شارة النطاق — تظهر فقط في وضع اليوم أو النطاق */}
      {mode !== 'month' && mode !== 'all' && (
        <div className="ndfb-badge">
          <span className="ndfb-badge__icon">◷</span>
          <span className="ndfb-badge__label">{label}</span>
        </div>
      )}

      {/* زر إعادة التعيين */}
      <Button type="button" variant="raw" className="ndfb-reset-btn" onClick={reset} title={t('dateFilterReset')}>
        ↺
      </Button>
    </div>
  );
}

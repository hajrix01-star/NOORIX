/**
 * DateFilterBar — شريط فلترة التواريخ المركزي
 * يدعم: اختيار شهر / يوم محدد / نطاق تاريخين
 * يرسل startDate/endDate كـ ISO strings بالمنطقة الزمنية السعودية (UTC+3)
 */
import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useDateFilter } from '../../hooks/useDateFilter';

export { useDateFilter };

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getSaudiNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const m = parts.reduce((a, p) => (p.type !== 'literal' ? { ...a, [p.type]: p.value } : a), {});
  return { year: parseInt(m.year, 10), month: parseInt(m.month, 10), day: parseInt(m.day, 10) };
}
function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ——— مكوّن الواجهة ———
const SEL = {
  base: {
    height: 34, padding: '0 10px', borderRadius: 8,
    border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)',
    color: 'var(--noorix-text)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
    outline: 'none',
  },
};

export default function DateFilterBar({ filter }) {
  const { t } = useTranslation();
  const MODES = [
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
    <div className="noorix-date-filter-bar" dir="rtl">
      {/* مجموعة أزرار الوضع */}
      <div className="ndfb-mode-group">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`ndfb-mode-btn${mode === m.id ? ' ndfb-mode-btn--active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* حقول الفلتر */}
      <div className="ndfb-fields">
        {mode === 'month' && (
          <>
            <select
              value={selYear}
              onChange={(e) => setSelYear(Number(e.target.value))}
              style={SEL.base}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={selMonth}
              onChange={(e) => setSelMonth(Number(e.target.value))}
              style={{ ...SEL.base, minWidth: 110 }}
            >
              {MONTH_NAMES_EN.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </>
        )}

        {mode === 'day' && (
          <input
            type="date"
            value={selDay}
            max={ymd(now.year, now.month, now.day)}
            onChange={(e) => setSelDay(e.target.value)}
            style={{ ...SEL.base, minWidth: 150 }}
          />
        )}

        {mode === 'range' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap' }}>{t('dateFilterFrom')}</span>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                style={{ ...SEL.base, minWidth: 140 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', whiteSpace: 'nowrap' }}>{t('dateFilterTo')}</span>
              <input
                type="date"
                value={rangeEnd}
                min={rangeStart}
                onChange={(e) => setRangeEnd(e.target.value)}
                style={{ ...SEL.base, minWidth: 140 }}
              />
            </div>
          </>
        )}
      </div>

      {/* شارة النطاق المحدد */}
      <div className="ndfb-badge">
        <span className="ndfb-badge__icon">📅</span>
        <span className="ndfb-badge__label">{label}</span>
      </div>

      {/* زر إعادة التعيين */}
      <button type="button" className="ndfb-reset-btn" onClick={reset} title={t('dateFilterReset')}>
        ↺
      </button>
    </div>
  );
}

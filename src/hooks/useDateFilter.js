/**
 * useDateFilter — Hook مركزي لفلترة التواريخ
 * يدعم: شهر / يوم محدد / نطاق تاريخين
 * يستخدم توقيت المملكة (Asia/Riyadh UTC+3)
 */
import { useState, useMemo, useCallback } from 'react';

function getSaudiNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const m = parts.reduce((a, p) => (p.type !== 'literal' ? { ...a, [p.type]: p.value } : a), {});
  return { year: parseInt(m.year, 10), month: parseInt(m.month, 10), day: parseInt(m.day, 10) };
}

function saudiDayStart(dateStr) {
  return `${dateStr}T00:00:00+03:00`;
}
function saudiDayEnd(dateStr) {
  return `${dateStr}T23:59:59+03:00`;
}
function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildLabel(mode, selYear, selMonth, selDay, rangeStart, rangeEnd) {
  if (mode === 'month') return `${MONTH_NAMES_EN[selMonth - 1]} ${selYear}`;
  if (mode === 'day')   return selDay.split('-').reverse().join('/');
  const s = (rangeStart || '').split('-').reverse().join('/');
  const e = (rangeEnd   || '').split('-').reverse().join('/');
  return `${s} — ${e}`;
}

export function useDateFilter() {
  const now = getSaudiNow();

  const [mode, setMode] = useState('month');
  const [selYear,  setSelYear]  = useState(now.year);
  const [selMonth, setSelMonth] = useState(now.month);
  const [selDay,   setSelDay]   = useState(ymd(now.year, now.month, now.day));
  const [rangeStart, setRangeStart] = useState(ymd(now.year, now.month, 1));
  const [rangeEnd,   setRangeEnd]   = useState(ymd(now.year, now.month, now.day));

  const { startDate, endDate } = useMemo(() => {
    if (mode === 'month') {
      const last = lastDayOfMonth(selYear, selMonth);
      return {
        startDate: saudiDayStart(ymd(selYear, selMonth, 1)),
        endDate:   saudiDayEnd(ymd(selYear, selMonth, last)),
      };
    }
    if (mode === 'day') {
      return {
        startDate: saudiDayStart(selDay),
        endDate:   saudiDayEnd(selDay),
      };
    }
    const s = rangeStart || ymd(now.year, now.month, 1);
    const e = rangeEnd   || ymd(now.year, now.month, now.day);
    return {
      startDate: saudiDayStart(s <= e ? s : e),
      endDate:   saudiDayEnd(s <= e ? e : s),
    };
  }, [mode, selYear, selMonth, selDay, rangeStart, rangeEnd, now.year, now.month, now.day]);

  const reset = useCallback(() => {
    const n = getSaudiNow();
    setMode('month');
    setSelYear(n.year);
    setSelMonth(n.month);
    setSelDay(ymd(n.year, n.month, n.day));
    setRangeStart(ymd(n.year, n.month, 1));
    setRangeEnd(ymd(n.year, n.month, n.day));
  }, []);

  return {
    mode, setMode,
    selYear, setSelYear,
    selMonth, setSelMonth,
    selDay, setSelDay,
    rangeStart, setRangeStart,
    rangeEnd, setRangeEnd,
    startDate,
    endDate,
    reset,
    label: buildLabel(mode, selYear, selMonth, selDay, rangeStart, rangeEnd),
  };
}

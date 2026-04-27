/**
 * DashboardCalendarTab — تقويم حراري للمبيعات
 * أهداف احترافية | تحديد أيام متعددة → إضافة كأيام خاصة | ملاحظة لكل يوم
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useDashboardSalesPack } from '../../../hooks/useDashboardSalesPack';
import { CARD_COLORS } from '../../../utils/cardStyles';
import { KPI_RECHARTS_COLORS, AMBER_ACCENT_HEX } from '../../../constants/kpiCardTheme';
import { fmt } from '../../../utils/format';
import { openPrintWindow } from '../../../utils/printUtils';
import CalendarDayDetailPanel from './CalendarDayDetailPanel';
import { Button, Input, Modal , FmtNum } from '../../../ui';
import {
  getStoredTargets,
  setStoredTargets,
  getStoredSpecialDays,
  setStoredSpecialDays,
  getStoredDayNotes,
  setStoredDayNotes,
} from '../utils/dashboardStorage';
import { getSaudiNow, toYmd } from '../../../utils/saudiDate';

const DOW_KEYS = [0, 1, 2, 3, 4, 5, 6];
const DOW_LABELS = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
const DOW_LABELS_AR = { 0: 'أحد', 1: 'إثنين', 2: 'ثلاثاء', 3: 'أربعاء', 4: 'خميس', 5: 'جمعة', 6: 'سبت' };
const DEFAULT_COLORS = ['var(--color-noorix-amber)', '#eab308', '#84cc16', 'var(--noorix-accent-green)', '#8b5cf6'];

function lastDayOfMonth(year: any, month: any) {
  return new Date(year, month, 0).getDate();
}

function ymd(y: any, m: any, d: any) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getDayOfWeek(year: any, month: any, day: any) {
  return new Date(year, month - 1, day).getDay();
}

function dateInRange(dateStr: any, fromDate: any, toDate: any) {
  if (!fromDate || !toDate) return false;
  return dateStr >= fromDate && dateStr <= toDate;
}

/** شرائح ثابتة: أحمر &lt;80% | أصفر 80–99% | أخضر 100–119% | أزرق ≥120% من الهدف */
const ACHIEVEMENT_BG = {
  red:    'color-mix(in srgb, var(--color-nx-expenses) 34%, transparent)',
  yellow: 'color-mix(in srgb, var(--noorix-accent-amber) 32%, transparent)',
  green:  'color-mix(in srgb, var(--color-nx-profit) 32%, transparent)',
  blue:   'color-mix(in srgb, var(--color-nx-sales) 32%, transparent)',
};

function achievementBandFromRatio(ratio: any) {
  if (ratio >= 1.2) return 'blue';
  if (ratio >= 1) return 'green';
  if (ratio >= 0.8) return 'yellow';
  return 'red';
}

function hexToRgba(hex: any, alpha: any) {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function achievementBgForPrint(band: any) {
  const a = 0.38;
  switch (band) {
    case 'blue':   return hexToRgba(KPI_RECHARTS_COLORS.sales, a);
    case 'green':  return hexToRgba(KPI_RECHARTS_COLORS.grossProfit, a);
    case 'yellow': return hexToRgba(AMBER_ACCENT_HEX, a);
    case 'red':
    default:       return hexToRgba(KPI_RECHARTS_COLORS.expenses, a);
  }
}

export default function DashboardCalendarTab({ companyId, year, selectedMonth, filter }: any) {
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const now = getSaudiNow();
  const month = selectedMonth || now.month;
  const lastDay = lastDayOfMonth(year, month);

  const startDate = ymd(year, month, 1);
  const endDate = ymd(year, month, lastDay);

  const {
    dailySummaries: summaries,
    isLoading,
  } = useDashboardSalesPack({
    companyId,
    yearStart: `${year}-01-01`,
    yearEnd: `${year}-12-31`,
    dailyStart: startDate,
    dailyEnd: endDate,
    monthStart: null,
    monthEnd: null,
    enabled: !!companyId,
  });

  const [targetsVersion, setTargetsVersion] = useState(0);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [showTargetsPanel, setShowTargetsPanel] = useState(false);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(() => new Set<string>());
  const [lastClickedDate, setLastClickedDate] = useState<any>(null);
  const [specialDaysVersion, setSpecialDaysVersion] = useState(0);
  const [dayNotesVersion, setDayNotesVersion] = useState(0);
  const [showAddSpecialModal, setShowAddSpecialModal] = useState(false);
  const [newSpecialName, setNewSpecialName] = useState('');

  const storedTargets = useMemo(() => getStoredTargets(companyId, year, month), [companyId, year, month, targetsVersion]);
  const specialDaysList = useMemo(() => getStoredSpecialDays(companyId, year, month), [companyId, year, month, specialDaysVersion]);
  const dayNotes = useMemo(() => getStoredDayNotes(companyId, year, month), [companyId, year, month, dayNotesVersion]);

  const targets = useMemo(() => ({
    overall: storedTargets.overall,
    byDow: storedTargets.byDow || {},
  }), [storedTargets]);

  const dailySales = useMemo(() => {
    const map = new Map();
    (summaries || []).forEach((s: any) => {
      const d = toYmd(s.transactionDate);
      const amt = Number(s.totalAmount || 0);
      map.set(d, (map.get(d) || 0) + amt);
    });
    return map;
  }, [summaries]);

  /** إجمالي المبيعات ÷ عدد الأيام التي وُجدت فيها مبيعات &gt; 0 فقط */
  const salesDailyAvgOnActiveDays = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const amt of dailySales.values()) {
      if (amt > 0) {
        sum += amt;
        count += 1;
      }
    }
    if (count === 0) return null;
    return sum / count;
  }, [dailySales]);

  const daysInMonth = useMemo(() => {
    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = ymd(year, month, d);
      const dow = getDayOfWeek(year, month, d);
      const dayTarget = targets.byDow[dow] != null ? Number(targets.byDow[dow]) : targets.overall;
      const special = specialDaysList.find((sp: any) => dateInRange(dateStr, sp.fromDate, sp.toDate));
      days.push({
        day: d,
        dateStr,
        dow,
        amount: dailySales.get(dateStr) || 0,
        dayTarget: dayTarget != null ? Number(dayTarget) : null,
        special: special || null,
      });
    }
    return days;
  }, [year, month, lastDay, dailySales, targets, specialDaysList]);

  const maxAmount = useMemo(() => {
    const dowNums = Object.values(targets.byDow).map((v) => (v != null && v !== '' ? Number(v) : 0));
    const maxFromTargets = Math.max(0, targets.overall != null ? Number(targets.overall) : 0, ...dowNums);
    return Math.max(1, ...daysInMonth.map((d: any) => d.amount), maxFromTargets);
  }, [daysInMonth, targets]);

  const company = companies?.find((c: any) => c.id === companyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');

  const handleSaveOverallTarget = useCallback(() => {
    const v = parseFloat(String(targetInput).replace(/,/g, ''));
    if (!Number.isNaN(v) && v >= 0) {
      const data = getStoredTargets(companyId, year, month);
      data.overall = v;
      if (setStoredTargets(companyId, year, month, data)) {
        setTargetInput('');
        setEditingTarget(false);
        setTargetsVersion((v: any) => v + 1);
      }
    }
  }, [companyId, year, month, targetInput]);

  const handleSaveDowTarget = useCallback((dow: any, value: any) => {
    const str = String(value || '').trim();
    const v = str === '' ? null : parseFloat(str.replace(/,/g, ''));
    if (v === null || (!Number.isNaN(v) && v >= 0)) {
      const data = getStoredTargets(companyId, year, month);
      data.byDow = data.byDow || {};
      if (v === null) delete data.byDow[dow];
      else data.byDow[dow] = v;
      if (setStoredTargets(companyId, year, month, data)) {
        setTargetsVersion((prev: any) => prev + 1);
      }
    }
  }, [companyId, year, month]);

  const handleSaveDayNote = useCallback((dateStr: any, note: any) => {
    const notes = getStoredDayNotes(companyId, year, month);
    if (note) notes[dateStr] = note;
    else delete notes[dateStr];
    if (setStoredDayNotes(companyId, year, month, notes)) {
      setDayNotesVersion((v: any) => v + 1);
    }
  }, [companyId, year, month]);

  const handleDayClick = useCallback((item: any, isShift: any) => {
    const dateStr = item.dateStr;
    setSelectedDay(item);
    if (!isSelectionMode) {
      return;
    }
    if (isShift && lastClickedDate) {
      const dates = [...daysInMonth.map((d: any) => d.dateStr)];
      const i1 = dates.indexOf(lastClickedDate);
      const i2 = dates.indexOf(dateStr);
      if (i1 >= 0 && i2 >= 0) {
        const [from, to] = i1 <= i2 ? [i1, i2] : [i2, i1];
        const range = new Set<string>(dates.slice(from, to + 1));
        setSelectedDates(range);
        setLastClickedDate(dateStr);
        return;
      }
    }
    setLastClickedDate(dateStr);
    setSelectedDates((prev) => {
      const next = new Set<string>(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  }, [isSelectionMode, lastClickedDate, daysInMonth]);

  const handleAddSelectedAsSpecial = useCallback(() => {
    const sorted = [...selectedDates].filter((d: any) => d >= startDate && d <= endDate).sort();
    if (sorted.length === 0) return;
    const from = sorted[0];
    const to = sorted[sorted.length - 1];
    const name = (newSpecialName || t('dashboardSpecialDay')).trim();
    const list = getStoredSpecialDays(companyId, year, month);
    const id = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const color = DEFAULT_COLORS[list.length % DEFAULT_COLORS.length];
    list.push({ id, name, fromDate: from, toDate: to, color });
    if (setStoredSpecialDays(companyId, year, month, list)) {
      setSpecialDaysVersion((v: any) => v + 1);
      setSelectedDates(new Set<string>());
      setShowAddSpecialModal(false);
      setNewSpecialName('');
    }
  }, [companyId, year, month, selectedDates, startDate, endDate, newSpecialName, t]);

  const handlePrintDayDetails = useCallback((dateStr: any, dayTarget: any, daySummaries: any, totalAmount: any, achieved: any) => {
    const rows = daySummaries.map((s: any) => {
      const chText = (s.channels || []).map((ch: any) => `${ch.vault?.nameAr || ch.vault?.nameEn || '—'}: ${fmt(ch.amount || 0)}`).join(' | ');
      return `<tr><td>${(s.summaryNumber || '—').replace(/</g, '&lt;')}</td><td>${chText.replace(/</g, '&lt;')}</td><td>${s.customerCount ?? 0}</td><td>${fmt(Number(s.totalAmount || 0))}</td></tr>`;
    }).join('');
    const targetInfo = `<div style="background:#eff6ff;padding:12px;border-radius:8px;margin:12px 0;font-size:13px">
      <strong>${t('dashboardSalesTarget')}:</strong> ${dayTarget != null ? fmt(dayTarget) : '—'} SR &nbsp;|&nbsp;
      <strong>${t('total')}:</strong> <span style="color:${achieved ? '#16a34a' : 'inherit'}">${fmt(totalAmount)} SR${achieved ? ' ✓' : ''}</span>
    </div>`;
    openPrintWindow({
      title: `${t('transactions')} — ${dateStr}`,
      companyName: companyName || '',
      subtitle: `${t('dashboardCalendar')} — ${dateStr}`,
      body: `${targetInfo}<table><thead><tr><th>${t('summaryNumber')}</th><th>${t('salesChannels')}</th><th>${t('customers')}</th><th>${t('total')}</th></tr></thead><tbody>${rows || '<tr><td colspan="4">' + t('noDataInPeriod') + '</td></tr>'}</tbody><tfoot><tr><td colspan="3">${t('total')}</td><td>${fmt(totalAmount)} SR</td></tr></tfoot></table>`,
    });
  }, [t, companyName]);

  const monthLabel = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month - 1];

  const handlePrintCalendar = useCallback(() => {
    const cells = daysInMonth.map((item: any) => {
      const { day, dateStr, amount, dayTarget, special } = item;
      const ratio = dayTarget != null && dayTarget > 0 ? amount / dayTarget : 0;
      const achieved = dayTarget != null && amount >= dayTarget;
      let bg = '#f8fafc';
      if (amount > 0) {
        if (special) {
          const hex = (special.color || '#8b5cf6').replace('#', '');
          const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
          bg = `rgba(${r},${g},${b},0.35)`;
        } else if (dayTarget != null && dayTarget > 0) {
          const band = achievementBandFromRatio(ratio);
          bg = achievementBgForPrint(band);
        } else {
          const intensity = Math.min(1, amount / maxAmount);
          bg = hexToRgba(KPI_RECHARTS_COLORS.grossProfit, 0.2 + intensity * 0.28);
        }
      }
      return `<td style="padding:6px;text-align:center;border:1px solid #ddd;background:${bg}">${day}<br><span style="font-weight:700">${fmt(amount, 0)}</span>${achieved ? ' ✓' : ''}</td>`;
    });
    const firstDow = new Date(year, month - 1, 1).getDay();
    const blanks = Array(firstDow).fill('<td></td>').join('');
    const rows = [];
    let row = blanks;
    cells.forEach((cell: any, i: any) => {
      row += cell;
      if ((firstDow + i + 1) % 7 === 0) { rows.push(`<tr>${row}</tr>`); row = ''; }
    });
    if (row) rows.push(`<tr>${row}</tr>`);
    const dowHeader = lang === 'ar' ? DOW_LABELS_AR : DOW_LABELS;
    const dowOrder = [0, 1, 2, 3, 4, 5, 6] as const;
    const headerRow = `<tr>${dowOrder.map((d) => `<th>${dowHeader[d]}</th>`).join('')}</tr>`;
    openPrintWindow({
      title: t('dashboardCalendar'),
      companyName: companyName || '',
      subtitle: `${t('dashboardCalendar')} — ${monthLabel} ${year}`,
      body: `<table><thead>${headerRow}</thead><tbody>${rows.join('')}</tbody></table>`,
    });
  }, [daysInMonth, year, month, monthLabel, companyName, t, lang, maxAmount]);

  const selectedDatesSorted = useMemo(() => [...selectedDates].filter((d: any) => d >= startDate && d <= endDate).sort(), [selectedDates, startDate, endDate]);

  if (!companyId) {
    return (
      <div className="noorix-surface-card text-center text-noorix-muted p-6">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  return (
    <div className="noorix-calendar-layout">
      {/* ── التقويم ── */}
      <div
        className="noorix-calendar-card noorix-surface-card overflow-hidden p-4 w-full max-w-[760px] min-w-0"
      >
        <div className="flex items-center justify-between flex flex-wrap gap-2 mb-3">
          <div className="text-[13px] font-bold" style={{ color: CARD_COLORS.sales.accent }}>
            {t('dashboardCalendar')} — {monthLabel} {year}
          </div>
          <div className="nx-toolbar">
            <Button
              size="sm"
              variant={isSelectionMode ? 'primary' : undefined}
              onClick={() => { setIsSelectionMode((p: any) => !p); if (isSelectionMode) setSelectedDates(new Set<string>()); }}
            >
              {isSelectionMode ? '✓ ' + t('dashboardSelectDaysModeOff') : '☑ ' + t('dashboardSelectDaysMode')}
            </Button>
            <Button size="sm" onClick={() => setShowTargetsPanel(!showTargetsPanel)}>⚙ {t('dashboardSetTarget')}</Button>
            <Button size="sm" variant="primary" onClick={handlePrintCalendar}>{t('print')}</Button>
          </div>
        </div>

        {salesDailyAvgOnActiveDays != null && (
          <div className="text-[11px] text-noorix-muted mb-2 flex flex-wrap items-baseline gap-1">
            <span>{t('dashboardSalesDailyAvgActiveDays')}</span>
            <span className="font-semibold text-noorix-text nx-font-numbers">
              <FmtNum n={salesDailyAvgOnActiveDays} /> <span className="nx-sar">SR</span>
            </span>
          </div>
        )}

        {showTargetsPanel && (
          <div className="p-3 mb-3 bg-noorix-bg-muted rounded-lg text-[12px]">
            <div className="font-bold mb-2">{t('dashboardTargetOverall')}</div>
            {editingTarget ? (
              <div className="flex items-center gap-8 mb-[10px]">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={targetInput}
                  onChange={(e: any) => setTargetInput(e.target.value)}
                  placeholder={t('dashboardSalesTarget')}
                  className="w-[120px]"
                />
                <Button variant="primary" onClick={handleSaveOverallTarget}>{t('save')}</Button>
                <Button onClick={() => { setEditingTarget(false); setTargetInput(''); }}>{t('cancel')}</Button>
              </div>
            ) : (
              <div className="flex items-center gap-8 mb-[10px]">
                <span style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{targets.overall != null ? fmt(targets.overall) : '—'} <span className="nx-sar">SR</span></span>
                <Button onClick={() => { setTargetInput(targets.overall != null ? String(targets.overall) : ''); setEditingTarget(true); }}>{t('edit')}</Button>
              </div>
            )}
            <div className="font-bold mb-1.5">{t('dashboardTargetByDay')}</div>
            <div className="flex flex-wrap gap-2" key={`targets-${targetsVersion}`}>
              {DOW_KEYS.map((dow) => (
                <div key={dow} className="flex items-center gap-4">
                  <span className="text-[11px] min-w-[50px]">{lang === 'ar' ? DOW_LABELS_AR[dow as keyof typeof DOW_LABELS_AR] : DOW_LABELS[dow as keyof typeof DOW_LABELS]}:</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="—"
                    defaultValue={targets.byDow[dow] ?? ''}
                    onBlur={(e: any) => handleSaveDowTarget(dow, e.target.value)}
                    className="w-[70px]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {isSelectionMode && (
          <div className="mb-2 text-[10px]" style={{ color: 'var(--noorix-accent-blue)' }}>{t('dashboardSelectDaysHint')}</div>
        )}

        {isLoading ? (
          <div className="text-center text-noorix-muted text-[13px] p-8">{t('loading')}</div>
        ) : (
          <div className="noorix-calendar-grid-scroll">
            <div className="noorix-calendar-grid-scroll-inner">
          <div className="grid gap-1.5 grid-cols-7">
            {([0, 1, 2, 3, 4, 5, 6] as const).map((d) => (
              <div key={d} className="text-[12px] font-bold text-noorix-muted text-center py-1.5">{lang === 'ar' ? DOW_LABELS_AR[d] : DOW_LABELS[d]}</div>
            ))}
            {(() => {
              const firstDow = new Date(year, month - 1, 1).getDay();
              const blanks = Array(firstDow).fill(null);
              const cells = [...blanks, ...daysInMonth];
              return cells.map((item: any, i: any) => {
                if (!item) return <div key={`b-${i}`} />;
                const { day, dateStr, amount, dayTarget, special } = item;
                const isSelected = isSelectionMode && selectedDates.has(dateStr);
                const specialColor = special ? (special.color || '#8b5cf6') : null;
                let bg = 'var(--noorix-bg-muted)';
                if (amount > 0) {
                  if (special) {
                    const hex = (specialColor || '#8b5cf6').replace('#', '');
                    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
                    bg = `rgba(${r},${g},${b},0.35)`;
                  } else if (dayTarget != null && dayTarget > 0) {
                    const ratio = amount / dayTarget;
                    const band = achievementBandFromRatio(ratio);
                    bg = ACHIEVEMENT_BG[band];
                  } else {
                    const intensity = Math.min(1, amount / maxAmount);
                    bg = `color-mix(in srgb, var(--color-nx-profit) ${Math.round(16 + intensity * 26)}%, transparent)`;
                  }
                } else if (special && specialColor) {
                  const hex = specialColor.replace('#', '');
                  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
                  bg = `rgba(${r},${g},${b},0.2)`;
                }
                const achieved = dayTarget != null && amount >= dayTarget;
                const ratioVsTarget = dayTarget != null && dayTarget > 0 ? amount / dayTarget : null;
                let cellBorder = '1px solid var(--noorix-border)';
                if (isSelected) cellBorder = '2px solid var(--noorix-accent-blue)';
                else if (selectedDay?.dateStr === dateStr) cellBorder = '2px solid var(--noorix-accent-blue)';
                else if (ratioVsTarget != null && amount > 0) {
                  if (ratioVsTarget >= 1.2) cellBorder = '2px solid var(--color-nx-sales)';
                  else if (ratioVsTarget >= 1) cellBorder = '2px solid var(--color-nx-profit)';
                  else if (special && specialColor) cellBorder = `2px solid ${specialColor}`;
                } else if (special && specialColor) cellBorder = `2px solid ${specialColor}`;
                const hasNote = dayNotes[dateStr];
                return (
                  <div
                    key={dateStr}
                    role="button"
                    tabIndex={0}
                    onClick={(e: any) => handleDayClick(item, e.shiftKey)}
                    onKeyDown={(e: any) => { if (e.key === 'Enter' || e.key === ' ') handleDayClick(item, e.shiftKey); }}
                    className="aspect-square rounded-md flex flex-col items-center justify-center p-[2px] min-h-12 cursor-pointer relative"
                    style={{
                      background: bg,
                      border: cellBorder,
                    }}
                    title={`${dateStr}: ${fmt(amount)} SR${dayTarget != null ? ` | ${t('dashboardSalesTarget')}: ${fmt(dayTarget)}` : ''}${special ? ` | ${special.name || ''}` : ''}${hasNote ? ` | ${hasNote}` : ''}`}
                  >
                    <span className="text-[12px] font-bold text-noorix-text">{day}</span>
                    <span
                      className="text-[11px] nx-font-numbers"
                      style={{
                        color:
                          amount <= 0
                            ? 'var(--noorix-text-muted)'
                            : special
                              ? 'var(--noorix-text)'
                              : ratioVsTarget != null && ratioVsTarget >= 1.2
                                ? 'var(--color-nx-sales)'
                                : ratioVsTarget != null && ratioVsTarget >= 1
                                  ? 'var(--color-nx-profit)'
                                  : ratioVsTarget != null && ratioVsTarget >= 0.8
                                    ? 'var(--noorix-accent-amber)'
                                    : ratioVsTarget != null
                                      ? 'var(--color-nx-expenses)'
                                      : 'var(--color-nx-profit)',
                      }}
                    >
                      {fmt(amount, 0)}
                    </span>
                    {achieved && (
                      <span
                        className="text-[8px]"
                        style={{
                          color: ratioVsTarget != null && ratioVsTarget >= 1.2 ? 'var(--color-nx-sales)' : 'var(--color-nx-profit)',
                        }}
                      >
                        ✓
                      </span>
                    )}
                    {hasNote && <span className="text-[8px] w-[6px] h-[6px] rounded-full inline-block" style={{ color: 'var(--noorix-accent-blue)', background: 'var(--noorix-accent-blue)' }} />}
                    {special && specialColor && (
                      <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-md" style={{ background: specialColor }} />
                    )}
                  </div>
                );
              });
            })()}
          </div>
            </div>
          </div>
        )}

        {isSelectionMode && selectedDatesSorted.length > 0 && (
          <div className="mt-3 rounded-lg p-2.5" style={{ background: 'var(--noorix-blue-8)', border: '1px solid var(--noorix-blue-20)' }}>
            <div className="text-[11px] font-bold mb-1.5">{t('dashboardSelectedDays')}: {selectedDatesSorted.length}</div>
            <div className="nx-toolbar">
              <Button size="sm" variant="primary" onClick={() => setShowAddSpecialModal(true)}>
                + {t('dashboardAddAsSpecialDays')}
              </Button>
              <Button size="sm" onClick={() => setSelectedDates(new Set<string>())}>{t('cancel')}</Button>
            </div>
          </div>
        )}

        <div className="mt-4 p-3 bg-noorix-bg-muted rounded-lg text-[11px]">
          <div className="font-bold mb-2 text-noorix-text">{lang === 'ar' ? 'دليل الألوان' : 'Color legend'}</div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-8">
              <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'var(--noorix-border)', border: '1px solid var(--noorix-border)' }} />
              <span>{t('dashboardLegendGray')}</span>
            </div>
            <div className="flex items-center gap-8">
              <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'var(--color-nx-expenses)' }} />
              <span>{t('dashboardLegendRed')}</span>
            </div>
            <div className="flex items-center gap-8">
              <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'var(--noorix-accent-amber)' }} />
              <span>{t('dashboardLegendYellow')}</span>
            </div>
            <div className="flex items-center gap-8">
              <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'var(--color-nx-profit)' }} />
              <span>{t('dashboardLegendGreen')}</span>
            </div>
            <div className="flex items-center gap-8">
              <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'var(--color-nx-sales)' }} />
              <span>{t('dashboardLegendBlue')}</span>
            </div>
            <div className="flex items-center gap-8">
              <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'color-mix(in srgb, var(--color-nx-profit) 45%, transparent)' }} />
              <span>{t('dashboardLegendGreenNoTarget')}</span>
            </div>
            <div className="flex items-center gap-8">
              <span className="w-[14px] h-[14px] rounded shrink-0" style={{ background: 'var(--noorix-violet-50)' }} />
              <span>{t('dashboardLegendSpecial')}</span>
            </div>
          </div>
          {targets.overall != null && (
            <div className="text-noorix-muted mt-2 border-t border-noorix-border pt-2 text-[10px]">
              {t('dashboardSalesTarget')}: <FmtNum n={targets.overall} /> <span className="nx-sar">SR</span>
            </div>
          )}
        </div>
      </div>

      {/* ── تفاصيل اليوم + ملاحظة ── */}
      <div className="noorix-calendar-side min-w-[260px]">
        {selectedDay && (
          <CalendarDayDetailPanel
            dateStr={selectedDay.dateStr}
            dayAmount={selectedDay.amount}
            dayTarget={selectedDay.dayTarget}
            summaries={summaries}
            companyId={companyId}
            companyName={companyName}
            dayNote={dayNotes[selectedDay.dateStr]}
            onSaveNote={(note: any) => handleSaveDayNote(selectedDay.dateStr, note)}
            onPrint={() => {
              const daySummaries = (summaries || []).filter((s: any) => toYmd(s.transactionDate) === selectedDay.dateStr);
              const totalAmount = daySummaries.reduce((s: any, x: any) => s + Number(x.totalAmount || 0), 0);
              const achieved = selectedDay.dayTarget != null && totalAmount >= selectedDay.dayTarget;
              handlePrintDayDetails(selectedDay.dateStr, selectedDay.dayTarget, daySummaries, totalAmount, achieved);
            }}
          />
        )}
      </div>

      {/* نافذة إضافة أيام خاصة من التحديد */}
      {selectedDatesSorted.length > 0 && (
        <Modal
          open={showAddSpecialModal}
          onClose={() => { setShowAddSpecialModal(false); setNewSpecialName(''); }}
          title={t('dashboardAddAsSpecialDays')}
          size="sm"
        >
          <p className="text-[12px] text-noorix-muted mb-3 m-0">
            {selectedDatesSorted[0]} — {selectedDatesSorted[selectedDatesSorted.length - 1]} ({selectedDatesSorted.length} {lang === 'ar' ? 'أيام' : 'days'})
          </p>
          <Input
            value={newSpecialName}
            onChange={(e: any) => setNewSpecialName(e.target.value)}
            placeholder={t('dashboardSpecialDayName')}
          />
          <div className="flex items-center justify-end gap-2 mt-4">
            <Button onClick={() => { setShowAddSpecialModal(false); setNewSpecialName(''); }}>{t('cancel')}</Button>
            <Button variant="primary" onClick={handleAddSelectedAsSpecial}>{t('save')}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

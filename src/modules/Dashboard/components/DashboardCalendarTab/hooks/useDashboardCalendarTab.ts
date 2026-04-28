import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '../../../../../i18n/useTranslation';
import { useApp } from '../../../../../context/AppContext';
import { useDashboardSalesPack } from '../../../../../hooks/useDashboardSalesPack';
import { fmt } from '../../../../../utils/format';
import { openPrintWindow } from '../../../../../utils/printUtils';
import {
  getStoredTargets,
  setStoredTargets,
  getStoredSpecialDays,
  setStoredSpecialDays,
  getStoredDayNotes,
  setStoredDayNotes,
} from '../../../utils/dashboardStorage';
import { getSaudiNow, toYmd } from '../../../../../utils/saudiDate';
import {
  lastDayOfMonth,
  calendarYmd,
  getDayOfWeek,
  dateInRange,
} from '../utils/calendarDateUtils';
import {
  achievementBandFromRatio,
  hexToRgba,
  achievementBgForPrint,
} from '../utils/calendarAchievementUtils';
import { KPI_RECHARTS_COLORS } from '../../../../../constants/kpiCardTheme';
import { DEFAULT_COLORS, DOW_LABELS, DOW_LABELS_AR, MONTH_LABELS_EN } from '../constants';
import type { DashboardCalendarTabProps } from '../types';

export function useDashboardCalendarTab({ companyId, year, selectedMonth }: DashboardCalendarTabProps) {
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const now = getSaudiNow();
  const month = selectedMonth || now.month;
  const lastDay = lastDayOfMonth(year, month);

  const startDate = calendarYmd(year, month, 1);
  const endDate = calendarYmd(year, month, lastDay);

  const {
    dailySummaries: summaries,
    isLoading,
  } = useDashboardSalesPack({
    companyId: companyId as string,
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

  const targets = useMemo(
    () => ({
      overall: storedTargets.overall,
      byDow: storedTargets.byDow || {},
    }),
    [storedTargets],
  );

  const dailySales = useMemo(() => {
    const map = new Map();
    (summaries || []).forEach((s: any) => {
      const d = toYmd(s.transactionDate);
      const amt = Number(s.totalAmount || 0);
      map.set(d, (map.get(d) || 0) + amt);
    });
    return map;
  }, [summaries]);

  /** إجمالي المبيعات ÷ عدد الأيام التي وُجدت فيها مبيعات > 0 فقط */
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
      const dateStr = calendarYmd(year, month, d);
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
  const companyName = lang === 'en' ? company?.nameEn || company?.nameAr || '' : company?.nameAr || company?.nameEn || '';

  const handleSaveOverallTarget = useCallback(() => {
    const v = parseFloat(String(targetInput).replace(/,/g, ''));
    if (!Number.isNaN(v) && v >= 0) {
      const data = getStoredTargets(companyId, year, month);
      data.overall = v;
      if (setStoredTargets(companyId, year, month, data)) {
        setTargetInput('');
        setEditingTarget(false);
        setTargetsVersion((x: number) => x + 1);
      }
    }
  }, [companyId, year, month, targetInput]);

  const handleSaveDowTarget = useCallback(
    (dow: number, value: unknown) => {
      const str = String(value || '').trim();
      const v = str === '' ? null : parseFloat(str.replace(/,/g, ''));
      if (v === null || (!Number.isNaN(v) && v >= 0)) {
        const data = getStoredTargets(companyId, year, month);
        data.byDow = data.byDow || {};
        if (v === null) delete data.byDow[dow];
        else data.byDow[dow] = v;
        if (setStoredTargets(companyId, year, month, data)) {
          setTargetsVersion((prev: number) => prev + 1);
        }
      }
    },
    [companyId, year, month],
  );

  const handleSaveDayNote = useCallback(
    (dateStr: string, note: unknown) => {
      const notes = getStoredDayNotes(companyId, year, month);
      if (note) notes[dateStr] = note;
      else delete notes[dateStr];
      if (setStoredDayNotes(companyId, year, month, notes)) {
        setDayNotesVersion((v: number) => v + 1);
      }
    },
    [companyId, year, month],
  );

  const handleDayClick = useCallback(
    (item: any, isShift: boolean) => {
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
    },
    [isSelectionMode, lastClickedDate, daysInMonth],
  );

  const handleAddSelectedAsSpecial = useCallback(() => {
    const sorted = [...selectedDates].filter((d: string) => d >= startDate && d <= endDate).sort();
    if (sorted.length === 0) return;
    const from = sorted[0];
    const to = sorted[sorted.length - 1];
    const name = (newSpecialName || t('dashboardSpecialDay')).trim();
    const list = getStoredSpecialDays(companyId, year, month);
    const id = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const color = DEFAULT_COLORS[list.length % DEFAULT_COLORS.length];
    list.push({ id, name, fromDate: from, toDate: to, color });
    if (setStoredSpecialDays(companyId, year, month, list)) {
      setSpecialDaysVersion((v: number) => v + 1);
      setSelectedDates(new Set<string>());
      setShowAddSpecialModal(false);
      setNewSpecialName('');
    }
  }, [companyId, year, month, selectedDates, startDate, endDate, newSpecialName, t]);

  const handlePrintDayDetails = useCallback(
    (dateStr: any, dayTarget: any, daySummaries: any, totalAmount: any, achieved: any) => {
      const rows = daySummaries
        .map((s: any) => {
          const chText = (s.channels || [])
            .map((ch: any) => `${ch.vault?.nameAr || ch.vault?.nameEn || '—'}: ${fmt(ch.amount || 0)}`)
            .join(' | ');
          return `<tr><td>${(s.summaryNumber || '—').replace(/</g, '&lt;')}</td><td>${chText.replace(/</g, '&lt;')}</td><td>${s.customerCount ?? 0}</td><td>${fmt(Number(s.totalAmount || 0))}</td></tr>`;
        })
        .join('');
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
    },
    [t, companyName],
  );

  const monthLabel = MONTH_LABELS_EN[month - 1];

  const handlePrintCalendar = useCallback(() => {
    const cells = daysInMonth.map((item: any) => {
      const { day, dateStr, amount, dayTarget, special } = item;
      const ratio = dayTarget != null && dayTarget > 0 ? amount / dayTarget : 0;
      const achieved = dayTarget != null && amount >= dayTarget;
      let bg = '#f8fafc';
      if (amount > 0) {
        if (special) {
          const hex = (special.color || '#8b5cf6').replace('#', '');
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
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
    const rows: string[] = [];
    let row = blanks;
    cells.forEach((cell: string, i: number) => {
      row += cell;
      if ((firstDow + i + 1) % 7 === 0) {
        rows.push(`<tr>${row}</tr>`);
        row = '';
      }
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

  const selectedDatesSorted = useMemo(
    () => [...selectedDates].filter((d: string) => d >= startDate && d <= endDate).sort(),
    [selectedDates, startDate, endDate],
  );

  return {
    t,
    lang,
    month,
    lastDay,
    startDate,
    endDate,
    summaries,
    isLoading,
    targetsVersion,
    setTargetsVersion,
    editingTarget,
    setEditingTarget,
    targetInput,
    setTargetInput,
    showTargetsPanel,
    setShowTargetsPanel,
    selectedDay,
    setSelectedDay,
    isSelectionMode,
    setIsSelectionMode,
    selectedDates,
    setSelectedDates,
    lastClickedDate,
    setLastClickedDate,
    specialDaysVersion,
    dayNotesVersion,
    showAddSpecialModal,
    setShowAddSpecialModal,
    newSpecialName,
    setNewSpecialName,
    targets,
    dailySales,
    salesDailyAvgOnActiveDays,
    daysInMonth,
    maxAmount,
    companyName,
    handleSaveOverallTarget,
    handleSaveDowTarget,
    handleSaveDayNote,
    handleDayClick,
    handleAddSelectedAsSpecial,
    handlePrintDayDetails,
    monthLabel,
    handlePrintCalendar,
    selectedDatesSorted,
    dayNotes,
    year,
  };
}

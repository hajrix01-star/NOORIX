import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '../../../../../i18n/useTranslation';
import { useApp } from '../../../../../context/AppContext';
import { useToast } from '../../../../../context/ToastContext';
import { useDashboardSalesPack } from '../../../../../hooks/useDashboardSalesPack';
import { useDashboardCalendarData } from '../../../../../hooks/useDashboardCalendarData';
import { fmt } from '../../../../../utils/format';
import { buildPrintHtmlTable, buildPrintTableHtml } from '../../../../../utils/printTableHtml';
import { openPrintWindow } from '../../../../../utils/printUtils';
import { getSaudiNow, toYmd } from '../../../../../utils/saudiDate';
import { vaultDisplayName } from '../../../../../utils/vaultDisplay';
import type {
  DashboardCalendarDay,
  DashboardCalendarTargets,
  DashboardSalesSummary,
  DashboardSpecialDay,
} from '../../../../../types/api/domains/dashboard';
import { computeRevenueMonthDailyAvg } from '../../../overview/utils/dashboardDailyAvg';
import { toDashboardNonNegativeNumber, toDashboardNumber } from '../../../utils/dashboardNumberModel';
import { dashboardDisplayName } from '../../../utils/dashboardDisplayName';
import { createDashboardSpecialDayId } from '../../../utils/dashboardSpecialDayId';
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

type PrintCalendarCell = {
  html: string;
  style: string;
};

function normalizeTargets(targets: DashboardCalendarTargets): DashboardCalendarTargets {
  return {
    overall: targets.overall ?? null,
    byDow: targets.byDow ?? {},
  };
}

function totalSummaryAmount(summary: DashboardSalesSummary): number {
  return toDashboardNumber(summary.totalAmount);
}

export function useDashboardCalendarTab({ companyId, year, selectedMonth }: DashboardCalendarTabProps) {
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const { showToast } = useToast();
  const now = getSaudiNow();
  const month = selectedMonth || now.month;
  const lastDay = lastDayOfMonth(year, month);

  const startDate = calendarYmd(year, month, 1);
  const endDate = calendarYmd(year, month, lastDay);

  const {
    dailySummaries: summaries,
    isLoading: salesLoading,
  } = useDashboardSalesPack({
    companyId: companyId ?? '',
    yearStart: `${year}-01-01`,
    yearEnd: `${year}-12-31`,
    dailyStart: startDate,
    dailyEnd: endDate,
    monthStart: null,
    monthEnd: null,
    enabled: !!companyId,
  });

  const {
    isLoading: calendarLoading,
    targets: storedTargets,
    specialDays: specialDaysList,
    dayNotes,
    isDefaultTargets,
    hasMonthOverride,
    saveTargets,
    saveSpecialDays,
    saveDayNotes,
    resetMonthTargets,
  } = useDashboardCalendarData({ companyId, year, month, enabled: !!companyId });

  const isLoading = salesLoading || calendarLoading;

  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [targetsVersion, setTargetsVersion] = useState(0);
  const [applyToAll, setApplyToAll] = useState(true);
  const [showTargetsPanel, setShowTargetsPanel] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DashboardCalendarDay | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(() => new Set<string>());
  const [lastClickedDate, setLastClickedDate] = useState<string | null>(null);
  const [showAddSpecialModal, setShowAddSpecialModal] = useState(false);
  const [newSpecialName, setNewSpecialName] = useState('');

  const targets = useMemo(() => normalizeTargets(storedTargets), [storedTargets]);

  const dailySales = useMemo(() => {
    const map = new Map<string, number>();
    summaries.forEach((summary) => {
      const date = toYmd(summary.transactionDate);
      const amount = totalSummaryAmount(summary);
      map.set(date, (map.get(date) ?? 0) + amount);
    });
    return map;
  }, [summaries]);

  const salesDailyAvgCalendarPeriod = useMemo(() => {
    return computeRevenueMonthDailyAvg({
      monthSales: summaries,
      year,
      month,
      todayYear: now.year,
      todayMonth: now.month,
      todayDay: now.day,
    }).avgDaily;
  }, [summaries, year, month, now.year, now.month, now.day]);

  const daysInMonth = useMemo<DashboardCalendarDay[]>(() => {
    const days: DashboardCalendarDay[] = [];
    for (let day = 1; day <= lastDay; day += 1) {
      const dateStr = calendarYmd(year, month, day);
      const dow = getDayOfWeek(year, month, day);
      const targetByDow = targets.byDow[dow];
      const dayTarget = targetByDow != null ? toDashboardNumber(targetByDow) : targets.overall;
      const special = specialDaysList.find((sp) => dateInRange(dateStr, sp.fromDate, sp.toDate)) ?? null;
      days.push({
        day,
        dateStr,
        dow,
        amount: dailySales.get(dateStr) ?? 0,
        dayTarget: dayTarget != null ? toDashboardNumber(dayTarget) : null,
        special,
      });
    }
    return days;
  }, [year, month, lastDay, dailySales, targets, specialDaysList]);

  const maxAmount = useMemo(() => {
    const dowNumbers = Object.values(targets.byDow).map((value) => toDashboardNumber(value));
    const maxFromTargets = Math.max(0, targets.overall ?? 0, ...dowNumbers);
    return Math.max(1, ...daysInMonth.map((day) => day.amount), maxFromTargets);
  }, [daysInMonth, targets]);

  const company = companies.find((item) => item.id === companyId);
  const companyName = dashboardDisplayName(company, lang);

  const showSaveError = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : t('saveFailed');
      showToast(message, 'error');
    },
    [showToast, t],
  );

  const handleSaveOverallTarget = useCallback(async () => {
    const value = toDashboardNonNegativeNumber(targetInput);
    if (value === null) return;
    const newTargets: DashboardCalendarTargets = { ...targets, byDow: { ...targets.byDow }, overall: value };
    try {
      await saveTargets(newTargets, applyToAll);
      setTargetInput('');
      setEditingTarget(false);
      setTargetsVersion((current) => current + 1);
    } catch (error) {
      showSaveError(error);
    }
  }, [targets, targetInput, saveTargets, applyToAll, showSaveError]);

  const handleSaveDowTarget = useCallback(
    async (dow: number, value: unknown) => {
      const textValue = String(value ?? '').trim();
      const targetValue = textValue === '' ? null : toDashboardNonNegativeNumber(textValue);
      if (textValue !== '' && targetValue === null) return;
      const newByDow = { ...targets.byDow };
      if (targetValue === null) delete newByDow[dow];
      else newByDow[dow] = targetValue;
      const newTargets: DashboardCalendarTargets = { ...targets, byDow: newByDow };
      try {
        await saveTargets(newTargets, applyToAll);
        setTargetsVersion((current) => current + 1);
      } catch (error) {
        showSaveError(error);
      }
    },
    [targets, saveTargets, applyToAll, showSaveError],
  );

  const handleResetMonthTargets = useCallback(async () => {
    try {
      await resetMonthTargets();
      setTargetsVersion((current) => current + 1);
    } catch (error) {
      showSaveError(error);
    }
  }, [resetMonthTargets, showSaveError]);

  const handleSaveDayNote = useCallback(
    async (dateStr: string, note: string) => {
      const trimmed = note.trim();
      const newNotes = { ...dayNotes };
      if (trimmed) newNotes[dateStr] = trimmed;
      else delete newNotes[dateStr];
      try {
        await saveDayNotes(newNotes);
      } catch (error) {
        showSaveError(error);
      }
    },
    [dayNotes, saveDayNotes, showSaveError],
  );

  const handleDayClick = useCallback(
    (item: DashboardCalendarDay, isShift: boolean) => {
      const dateStr = item.dateStr;
      setSelectedDay(item);
      if (!isSelectionMode) return;

      if (isShift && lastClickedDate) {
        const dates = daysInMonth.map((day) => day.dateStr);
        const firstIndex = dates.indexOf(lastClickedDate);
        const secondIndex = dates.indexOf(dateStr);
        if (firstIndex >= 0 && secondIndex >= 0) {
          const [from, to] = firstIndex <= secondIndex
            ? [firstIndex, secondIndex]
            : [secondIndex, firstIndex];
          setSelectedDates(new Set<string>(dates.slice(from, to + 1)));
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

  const handleAddSelectedAsSpecial = useCallback(async () => {
    const sorted = [...selectedDates].filter((date) => date >= startDate && date <= endDate).sort();
    if (!sorted.length) return;
    const from = sorted[0];
    const to = sorted[sorted.length - 1];
    const name = (newSpecialName || t('dashboardSpecialDay')).trim();
    const color = DEFAULT_COLORS[specialDaysList.length % DEFAULT_COLORS.length];
    const newSpecialDay: DashboardSpecialDay = {
      id: createDashboardSpecialDayId(),
      name,
      fromDate: from,
      toDate: to,
      color,
    };
    try {
      await saveSpecialDays([...specialDaysList, newSpecialDay]);
      setSelectedDates(new Set<string>());
      setShowAddSpecialModal(false);
      setNewSpecialName('');
    } catch (error) {
      showSaveError(error);
    }
  }, [selectedDates, startDate, endDate, newSpecialName, t, specialDaysList, saveSpecialDays, showSaveError]);

  const handlePrintDayDetails = useCallback(
    (
      dateStr: string,
      dayTarget: number | null,
      daySummaries: DashboardSalesSummary[],
      totalAmount: number,
      achieved: boolean,
    ) => {
      const printRows = daySummaries.map((summary) => ({
        summaryNumber: summary.summaryNumber || '-',
        channels: (summary.channels ?? [])
          .map((channel) => `${vaultDisplayName(channel.vault, lang)}: ${fmt(channel.amount || 0)}`)
          .join(' | ') || '-',
        customers: summary.customerCount ?? 0,
        total: fmt(totalSummaryAmount(summary)),
      }));
      const targetInfo = `<div style="background:#eff6ff;padding:12px;border-radius:8px;margin:12px 0;font-size:13px">
      <strong>${t('dashboardSalesTarget')}:</strong> ${dayTarget != null ? fmt(dayTarget) : '-'} SR &nbsp;|&nbsp;
      <strong>${t('total')}:</strong> <span style="color:${achieved ? '#16a34a' : 'inherit'}">${fmt(totalAmount)} SR${achieved ? ' ✓' : ''}</span>
    </div>`;
      const tableHtml = buildPrintTableHtml({
        columns: [
          { key: 'summaryNumber', header: t('summaryNumber') },
          { key: 'channels', header: t('salesChannels') },
          { key: 'customers', header: t('customers'), align: 'end' },
          { key: 'total', header: t('total'), align: 'end' },
        ],
        rows: printRows,
        emptyMessage: t('noDataInPeriod'),
        footerRows: [[
          { value: t('total'), colSpan: 3 },
          { value: `${fmt(totalAmount)} SR`, align: 'end' },
        ]],
      });
      openPrintWindow({
        title: `${t('transactions')} - ${dateStr}`,
        companyName,
        subtitle: `${t('dashboardCalendar')} - ${dateStr}`,
        body: `${targetInfo}${tableHtml}`,
      });
    },
    [t, companyName, lang],
  );

  const monthLabel = MONTH_LABELS_EN[month - 1];

  const handlePrintCalendar = useCallback(() => {
    const cells: PrintCalendarCell[] = daysInMonth.map((item) => {
      const { day, amount, dayTarget, special } = item;
      const ratio = dayTarget != null && dayTarget > 0 ? amount / dayTarget : 0;
      const achieved = dayTarget != null && amount >= dayTarget;
      let bg = '#f8fafc';
      if (amount > 0) {
        if (special) {
          const hex = (special.color || '#8b5cf6').replace('#', '');
          const red = parseInt(hex.slice(0, 2), 16);
          const green = parseInt(hex.slice(2, 4), 16);
          const blue = parseInt(hex.slice(4, 6), 16);
          bg = `rgba(${red},${green},${blue},0.35)`;
        } else if (dayTarget != null && dayTarget > 0) {
          const band = achievementBandFromRatio(ratio);
          bg = achievementBgForPrint(band);
        } else {
          const intensity = Math.min(1, amount / maxAmount);
          bg = hexToRgba(KPI_RECHARTS_COLORS.grossProfit, 0.2 + intensity * 0.28);
        }
      }
      return {
        html: `${day}<br><span style="font-weight:700">${fmt(amount, 0)}</span>${achieved ? ' ✓' : ''}`,
        style: `padding:6px;text-align:center;border:1px solid #ddd;background:${bg}`,
      };
    });
    const firstDow = new Date(year, month - 1, 1).getDay();
    const rows: Array<{ cells: Array<{ value?: string; html?: string; style?: string }> }> = [];
    let row: Array<{ value?: string; html?: string; style?: string }> = Array(firstDow).fill(null).map(() => ({ value: '' }));
    cells.forEach((cell, index) => {
      row.push(cell);
      if ((firstDow + index + 1) % 7 === 0) {
        rows.push({ cells: row });
        row = [];
      }
    });
    if (row.length) rows.push({ cells: row });
    const dowHeader = lang === 'ar' ? DOW_LABELS_AR : DOW_LABELS;
    const dowOrder = [0, 1, 2, 3, 4, 5, 6] as const;
    const tableHtml = buildPrintHtmlTable({
      tableClassName: 'dashboard-calendar-print-table',
      wrapperClassName: null,
      headerRows: [{
        cells: dowOrder.map((day) => ({ value: dowHeader[day] })),
      }],
      bodyRows: rows,
      emptyColSpan: 7,
    });
    openPrintWindow({
      title: t('dashboardCalendar'),
      companyName,
      subtitle: `${t('dashboardCalendar')} - ${monthLabel} ${year}`,
      body: tableHtml,
    });
  }, [daysInMonth, year, month, monthLabel, companyName, t, lang, maxAmount]);

  const selectedDatesSorted = useMemo(
    () => [...selectedDates].filter((date) => date >= startDate && date <= endDate).sort(),
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
    showAddSpecialModal,
    setShowAddSpecialModal,
    newSpecialName,
    setNewSpecialName,
    targets,
    dailySales,
    salesDailyAvgCalendarPeriod,
    daysInMonth,
    maxAmount,
    companyName,
    targetsVersion,
    isDefaultTargets,
    hasMonthOverride,
    applyToAll,
    setApplyToAll,
    handleSaveOverallTarget,
    handleSaveDowTarget,
    handleSaveDayNote,
    handleDayClick,
    handleAddSelectedAsSpecial,
    handleResetMonthTargets,
    handlePrintDayDetails,
    monthLabel,
    handlePrintCalendar,
    selectedDatesSorted,
    dayNotes,
    specialDaysList,
    year,
  };
}

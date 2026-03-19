/**
 * DashboardCalendarTab — تقويم حراري للمبيعات
 * أهداف احترافية | تحديد أيام متعددة → إضافة كأيام خاصة | ملاحظة لكل يوم
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useSales } from '../../../hooks/useSales';
import { CARD_COLORS, CARD_BORDER_RADIUS } from '../../../utils/cardStyles';
import { fmt } from '../../../utils/format';
import CalendarDayDetailPanel from './CalendarDayDetailPanel';
import {
  getStoredTargets,
  setStoredTargets,
  getStoredSpecialDays,
  setStoredSpecialDays,
  getStoredDayNotes,
  setStoredDayNotes,
} from '../utils/dashboardStorage';

const DOW_KEYS = [0, 1, 2, 3, 4, 5, 6];
const DOW_LABELS = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
const DOW_LABELS_AR = { 0: 'أحد', 1: 'إثنين', 2: 'ثلاثاء', 3: 'أربعاء', 4: 'خميس', 5: 'جمعة', 6: 'سبت' };
const DEFAULT_COLORS = ['#f59e0b', '#eab308', '#84cc16', '#22c55e', '#8b5cf6'];

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getSaudiNow() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const m = parts.reduce((a, p) => (p.type !== 'literal' ? { ...a, [p.type]: p.value } : a), {});
  return { year: parseInt(m.year, 10), month: parseInt(m.month, 10) };
}

function getDayOfWeek(year, month, day) {
  return new Date(year, month - 1, day).getDay();
}

function dateInRange(dateStr, fromDate, toDate) {
  if (!fromDate || !toDate) return false;
  return dateStr >= fromDate && dateStr <= toDate;
}

function getAchievementColor(ratio) {
  if (ratio >= 1) return 'rgb(22, 163, 74)';
  if (ratio <= 0) return 'rgb(220, 38, 38)';
  const t = Math.min(1, ratio);
  const r = Math.round(220 - (220 - 22) * t);
  const g = Math.round(38 + (163 - 38) * t);
  const b = Math.round(38 + (74 - 38) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function DashboardCalendarTab({ companyId, year, selectedMonth, filter }) {
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const now = getSaudiNow();
  const month = selectedMonth || now.month;
  const lastDay = lastDayOfMonth(year, month);

  const startDate = ymd(year, month, 1);
  const endDate = ymd(year, month, lastDay);

  const { summaries, isLoading } = useSales({ companyId, startDate, endDate });

  const [targetsVersion, setTargetsVersion] = useState(0);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [showTargetsPanel, setShowTargetsPanel] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [lastClickedDate, setLastClickedDate] = useState(null);
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
    (summaries || []).forEach((s) => {
      const d = String(s.transactionDate || '').slice(0, 10);
      const amt = Number(s.totalAmount || 0);
      map.set(d, (map.get(d) || 0) + amt);
    });
    return map;
  }, [summaries]);

  const daysInMonth = useMemo(() => {
    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = ymd(year, month, d);
      const dow = getDayOfWeek(year, month, d);
      const dayTarget = targets.byDow[dow] != null ? Number(targets.byDow[dow]) : targets.overall;
      const special = specialDaysList.find((sp) => dateInRange(dateStr, sp.fromDate, sp.toDate));
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
    const maxFromTargets = Math.max(0, ...Object.values(targets.byDow).filter(Boolean), targets.overall || 0);
    return Math.max(1, ...daysInMonth.map((d) => d.amount), maxFromTargets);
  }, [daysInMonth, targets]);

  const company = companies?.find((c) => c.id === companyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');

  const handleSaveOverallTarget = useCallback(() => {
    const v = parseFloat(String(targetInput).replace(/,/g, ''));
    if (!Number.isNaN(v) && v >= 0) {
      const data = getStoredTargets(companyId, year, month);
      data.overall = v;
      if (setStoredTargets(companyId, year, month, data)) {
        setTargetInput('');
        setEditingTarget(false);
        setTargetsVersion((v) => v + 1);
      }
    }
  }, [companyId, year, month, targetInput]);

  const handleSaveDowTarget = useCallback((dow, value) => {
    const str = String(value || '').trim();
    const v = str === '' ? null : parseFloat(str.replace(/,/g, ''));
    if (v === null || (!Number.isNaN(v) && v >= 0)) {
      const data = getStoredTargets(companyId, year, month);
      data.byDow = data.byDow || {};
      if (v === null) delete data.byDow[dow];
      else data.byDow[dow] = v;
      if (setStoredTargets(companyId, year, month, data)) {
        setTargetsVersion((prev) => prev + 1);
      }
    }
  }, [companyId, year, month]);

  const handleSaveDayNote = useCallback((dateStr, note) => {
    const notes = getStoredDayNotes(companyId, year, month);
    if (note) notes[dateStr] = note;
    else delete notes[dateStr];
    if (setStoredDayNotes(companyId, year, month, notes)) {
      setDayNotesVersion((v) => v + 1);
    }
  }, [companyId, year, month]);

  const handleDayClick = useCallback((item, isShift) => {
    const dateStr = item.dateStr;
    setSelectedDay(item);
    if (!isSelectionMode) {
      return;
    }
    if (isShift && lastClickedDate) {
      const dates = [...daysInMonth.map((d) => d.dateStr)];
      const i1 = dates.indexOf(lastClickedDate);
      const i2 = dates.indexOf(dateStr);
      if (i1 >= 0 && i2 >= 0) {
        const [from, to] = i1 <= i2 ? [i1, i2] : [i2, i1];
        const range = new Set(dates.slice(from, to + 1));
        setSelectedDates(range);
        setLastClickedDate(dateStr);
        return;
      }
    }
    setLastClickedDate(dateStr);
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  }, [isSelectionMode, lastClickedDate, daysInMonth]);

  const handleAddSelectedAsSpecial = useCallback(() => {
    const sorted = [...selectedDates].filter((d) => d >= startDate && d <= endDate).sort();
    if (sorted.length === 0) return;
    const from = sorted[0];
    const to = sorted[sorted.length - 1];
    const name = (newSpecialName || t('dashboardSpecialDay')).trim();
    const list = getStoredSpecialDays(companyId, year, month);
    const id = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const color = DEFAULT_COLORS[list.length % DEFAULT_COLORS.length];
    list.push({ id, name, fromDate: from, toDate: to, color });
    if (setStoredSpecialDays(companyId, year, month, list)) {
      setSpecialDaysVersion((v) => v + 1);
      setSelectedDates(new Set());
      setShowAddSpecialModal(false);
      setNewSpecialName('');
    }
  }, [companyId, year, month, selectedDates, startDate, endDate, newSpecialName, t]);

  const handlePrintDayDetails = useCallback((dateStr, dayTarget, daySummaries, totalAmount, achieved) => {
    const rows = daySummaries.map((s) => {
      const chText = (s.channels || []).map((ch) => `${ch.vault?.nameAr || ch.vault?.nameEn || '—'}: ${fmt(ch.amount || 0, 2)}`).join(' | ');
      return `<tr><td>${(s.summaryNumber || '—').replace(/</g, '&lt;')}</td><td>${chText.replace(/</g, '&lt;')}</td><td>${s.customerCount ?? 0}</td><td style="text-align:right;font-family:Cairo">${fmt(Number(s.totalAmount || 0), 2)}</td></tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${(t('transactions') || '').replace(/</g, '&lt;')} - ${dateStr}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:14px}table{width:100%;border-collapse:collapse}td,th{padding:8px 12px;border:1px solid #ddd;text-align:right}th{background:#2563eb;color:#fff;font-weight:700}.header{text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px}.target{background:rgba(37,99,235,0.08);padding:12px;border-radius:8px;margin:12px 0}.achieved{color:#16a34a}@media print{body{padding:0}}</style></head><body>
<div class="header"><h1 style="margin:0;font-size:20px">${(companyName || '').replace(/</g, '&lt;')}</h1><p style="margin:8px 0 0;font-size:14px">${(t('dashboardCalendar') || '').replace(/</g, '&lt;')} — ${dateStr.replace(/</g, '&lt;')}</p></div>
<div class="target"><strong>${(t('dashboardSalesTarget') || '').replace(/</g, '&lt;')}:</strong> ${dayTarget != null ? fmt(dayTarget, 2) : '—'} ﷼ &nbsp;|&nbsp; <strong>${(t('total') || '').replace(/</g, '&lt;')}:</strong> <span class="${achieved ? 'achieved' : ''}">${fmt(totalAmount, 2)} ﷼</span>${achieved ? ' ✓' : ''}</div>
<table><thead><tr><th>${(t('summaryNumber') || '').replace(/</g, '&lt;')}</th><th>${(t('salesChannels') || '').replace(/</g, '&lt;')}</th><th>${(t('customers') || '').replace(/</g, '&lt;')}</th><th>${(t('total') || '').replace(/</g, '&lt;')}</th></tr></thead><tbody>${rows || '<tr><td colspan="4">' + (t('noDataInPeriod') || '').replace(/</g, '&lt;') + '</td></tr>'}</tbody><tfoot><tr style="font-weight:700;background:rgba(37,99,235,0.08)"><td colspan="3">${(t('total') || '').replace(/</g, '&lt;')}</td><td style="text-align:right">${fmt(totalAmount, 2)} ﷼</td></tr></tfoot></table></body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onafterprint = () => { try { w.close(); } catch (_) {} };
      w.onload = () => setTimeout(() => w.print(), 300);
    }
  }, [t, companyName]);

  const monthLabel = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month - 1];

  const handlePrintCalendar = useCallback(() => {
    const cells = daysInMonth.map((item) => {
      const { day, dateStr, amount, dayTarget, special } = item;
      const ratio = dayTarget != null && dayTarget > 0 ? amount / dayTarget : (amount > 0 ? 1 : 0);
      const achieved = dayTarget != null && amount >= dayTarget;
      let bg = 'var(--noorix-bg-muted)';
      if (amount > 0) {
        if (special) {
          const hex = (special.color || '#8b5cf6').replace('#', '');
          const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
          bg = `rgba(${r},${g},${b},0.35)`;
        } else if (dayTarget != null && dayTarget > 0) {
          const c = getAchievementColor(ratio);
          bg = c.replace('rgb(', 'rgba(').replace(')', ', 0.4)');
        } else {
          const intensity = Math.min(1, amount / maxAmount);
          bg = `rgba(22,163,74,${0.2 + intensity * 0.5})`;
        }
      }
      return `<td style="padding:6px;text-align:center;border:1px solid #ddd;background:${bg};font-family:Cairo">${day}<br><span style="font-weight:700">${fmt(amount, 0)}</span>${achieved ? ' ✓' : ''}</td>`;
    });
    const firstDow = new Date(year, month - 1, 1).getDay();
    const blanks = Array(firstDow).fill('<td></td>').join('');
    const rows = [];
    let row = blanks;
    cells.forEach((cell, i) => {
      row += cell;
      if ((firstDow + i + 1) % 7 === 0) { rows.push(`<tr>${row}</tr>`); row = ''; }
    });
    if (row) rows.push(`<tr>${row}</tr>`);
    const dowHeader = (lang === 'ar' ? DOW_LABELS_AR : DOW_LABELS);
    const headerRow = `<tr>${[0,1,2,3,4,5,6].map((d) => `<th style="padding:8px;background:#2563eb;color:#fff;font-weight:700">${dowHeader[d]}</th>`).join('')}</tr>`;
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${(t('dashboardCalendar') || '').replace(/</g, '&lt;')}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:20px;font-size:13px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd}.header{text-align:center;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:16px}@media print{body{padding:0}}</style></head><body>
<div class="header"><h1 style="margin:0;font-size:18px">${(companyName || '').replace(/</g, '&lt;')}</h1><p style="margin:6px 0 0;font-size:14px">${(t('dashboardCalendar') || '').replace(/</g, '&lt;')} — ${monthLabel} ${year}</p></div>
<table><thead>${headerRow}</thead><tbody>${rows.join('')}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onafterprint = () => { try { w.close(); } catch (_) {} };
      w.onload = () => setTimeout(() => w.print(), 300);
    }
  }, [daysInMonth, year, month, monthLabel, companyName, t, lang, maxAmount]);

  const selectedDatesSorted = useMemo(() => [...selectedDates].filter((d) => d >= startDate && d <= endDate).sort(), [selectedDates, startDate, endDate]);

  if (!companyId) {
    return (
      <div className="noorix-surface-card" style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* ── التقويم ── */}
      <div
        style={{
          borderRadius: CARD_BORDER_RADIUS,
          border: '1px solid var(--noorix-border)',
          background: 'var(--noorix-bg-surface)',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          padding: 16,
          maxWidth: 760,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: CARD_COLORS.sales.accent }}>
            {t('dashboardCalendar')} — {monthLabel} {year}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`noorix-btn-nav ${isSelectionMode ? 'noorix-btn-primary' : ''}`}
              onClick={() => { setIsSelectionMode((p) => !p); if (isSelectionMode) setSelectedDates(new Set()); }}
              style={{ padding: '6px 10px', fontSize: 11 }}
            >
              {isSelectionMode ? '✓ ' + t('dashboardSelectDaysModeOff') : '☑ ' + t('dashboardSelectDaysMode')}
            </button>
            <button type="button" className="noorix-btn-nav" onClick={() => setShowTargetsPanel(!showTargetsPanel)} style={{ padding: '6px 10px', fontSize: 11 }}>⚙ {t('dashboardSetTarget')}</button>
            <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={handlePrintCalendar} style={{ padding: '6px 10px', fontSize: 11 }}>🖨 {t('print')}</button>
          </div>
        </div>

        {showTargetsPanel && (
          <div style={{ padding: 12, marginBottom: 12, background: 'var(--noorix-bg-muted)', borderRadius: 8, fontSize: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('dashboardTargetOverall')}</div>
            {editingTarget ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <input type="number" min="0" step="0.01" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} placeholder={t('dashboardSalesTarget')} style={{ width: 120, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--noorix-border)', fontSize: 12 }} />
                <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={handleSaveOverallTarget} style={{ padding: '6px 10px', fontSize: 11 }}>{t('save')}</button>
                <button type="button" className="noorix-btn-nav" onClick={() => { setEditingTarget(false); setTargetInput(''); }} style={{ padding: '6px 10px', fontSize: 11 }}>{t('cancel')}</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--noorix-font-numbers)' }}>{targets.overall != null ? fmt(targets.overall, 2) : '—'} ﷼</span>
                <button type="button" className="noorix-btn-nav" onClick={() => { setTargetInput(targets.overall != null ? String(targets.overall) : ''); setEditingTarget(true); }} style={{ padding: '4px 8px', fontSize: 10 }}>{t('edit')}</button>
              </div>
            )}
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('dashboardTargetByDay')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} key={`targets-${targetsVersion}`}>
              {DOW_KEYS.map((dow) => (
                <div key={dow} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ minWidth: 50, fontSize: 11 }}>{lang === 'ar' ? DOW_LABELS_AR[dow] : DOW_LABELS[dow]}:</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="—"
                    defaultValue={targets.byDow[dow] ?? ''}
                    onBlur={(e) => handleSaveDowTarget(dow, e.target.value)}
                    style={{ width: 70, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--noorix-border)', fontSize: 11 }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {isSelectionMode && (
          <div style={{ fontSize: 10, color: 'var(--noorix-accent-blue)', marginBottom: 8 }}>{t('dashboardSelectDaysHint')}</div>
        )}

        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--noorix-text-muted)', fontSize: 13 }}>{t('loading')}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {[0,1,2,3,4,5,6].map((d) => (
              <div key={d} style={{ fontSize: 12, fontWeight: 700, color: 'var(--noorix-text-muted)', textAlign: 'center', padding: '6px 0' }}>{lang === 'ar' ? DOW_LABELS_AR[d] : DOW_LABELS[d]}</div>
            ))}
            {(() => {
              const firstDow = new Date(year, month - 1, 1).getDay();
              const blanks = Array(firstDow).fill(null);
              const cells = [...blanks, ...daysInMonth];
              return cells.map((item, i) => {
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
                    const c = getAchievementColor(ratio);
                    bg = c.replace('rgb(', 'rgba(').replace(')', ', 0.35)');
                  } else {
                    const intensity = Math.min(1, amount / maxAmount);
                    bg = `rgba(22,163,74,${0.2 + intensity * 0.5})`;
                  }
                } else if (special && specialColor) {
                  const hex = specialColor.replace('#', '');
                  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
                  bg = `rgba(${r},${g},${b},0.2)`;
                }
                const achieved = dayTarget != null && amount >= dayTarget;
                const hasNote = dayNotes[dateStr];
                return (
                  <div
                    key={dateStr}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleDayClick(item, e.shiftKey)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDayClick(item, e.shiftKey); }}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 6,
                      background: bg,
                      border: isSelected ? '2px solid var(--noorix-accent-blue)' : selectedDay?.dateStr === dateStr ? '2px solid var(--noorix-accent-blue)' : achieved ? '2px solid #16a34a' : special ? `2px solid ${specialColor}` : '1px solid var(--noorix-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 2,
                      minHeight: 48,
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                    title={`${dateStr}: ${fmt(amount, 2)} ﷼${dayTarget != null ? ` | ${t('dashboardSalesTarget')}: ${fmt(dayTarget, 2)}` : ''}${special ? ` | ${special.name || ''}` : ''}${hasNote ? ` | ${hasNote}` : ''}`}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--noorix-text)' }}>{day}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--noorix-font-numbers)', color: amount > 0 ? '#166534' : 'var(--noorix-text-muted)' }}>{fmt(amount, 0)}</span>
                    {achieved && <span style={{ fontSize: 8, color: '#16a34a' }}>✓</span>}
                    {hasNote && <span style={{ fontSize: 8, color: 'var(--noorix-accent-blue)' }}>📝</span>}
                    {special && specialColor && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: specialColor, borderRadius: '0 0 6px 6px' }} />
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {isSelectionMode && selectedDatesSorted.length > 0 && (
          <div style={{ marginTop: 12, padding: 10, background: 'rgba(37,99,235,0.08)', borderRadius: 8, border: '1px solid rgba(37,99,235,0.2)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{t('dashboardSelectedDays')}: {selectedDatesSorted.length}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={() => setShowAddSpecialModal(true)} style={{ padding: '6px 12px', fontSize: 11 }}>
                + {t('dashboardAddAsSpecialDays')}
              </button>
              <button type="button" className="noorix-btn-nav" onClick={() => setSelectedDates(new Set())} style={{ padding: '6px 10px', fontSize: 10 }}>{t('cancel')}</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, padding: 12, background: 'var(--noorix-bg-muted)', borderRadius: 8, fontSize: 11 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--noorix-text)' }}>{lang === 'ar' ? 'دليل الألوان' : 'Color legend'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#e5e7eb', border: '1px solid #d1d5db', flexShrink: 0 }} />
              <span>{t('dashboardLegendGray')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'rgb(220, 38, 38)', flexShrink: 0 }} />
              <span>{t('dashboardLegendRed')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'rgb(234, 179, 8)', flexShrink: 0 }} />
              <span>{t('dashboardLegendYellow')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'rgb(22, 163, 74)', flexShrink: 0 }} />
              <span>{t('dashboardLegendGreen')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'rgba(22,163,74,0.5)', flexShrink: 0 }} />
              <span>{t('dashboardLegendGreenNoTarget')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'rgba(139,92,246,0.5)', flexShrink: 0 }} />
              <span>{t('dashboardLegendSpecial')}</span>
            </div>
          </div>
          {targets.overall != null && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--noorix-border)', fontSize: 10, color: 'var(--noorix-text-muted)' }}>
              {t('dashboardSalesTarget')}: {fmt(targets.overall, 2)} ﷼
            </div>
          )}
        </div>
      </div>

      {/* ── تفاصيل اليوم + ملاحظة ── */}
      <div style={{ minWidth: 260 }}>
        {selectedDay && (
          <CalendarDayDetailPanel
            dateStr={selectedDay.dateStr}
            dayAmount={selectedDay.amount}
            dayTarget={selectedDay.dayTarget}
            summaries={summaries}
            companyId={companyId}
            companyName={companyName}
            dayNote={dayNotes[selectedDay.dateStr]}
            onSaveNote={(note) => handleSaveDayNote(selectedDay.dateStr, note)}
            onPrint={() => {
              const daySummaries = (summaries || []).filter((s) => String(s.transactionDate || '').slice(0, 10) === selectedDay.dateStr);
              const totalAmount = daySummaries.reduce((s, x) => s + Number(x.totalAmount || 0), 0);
              const achieved = selectedDay.dayTarget != null && totalAmount >= selectedDay.dayTarget;
              handlePrintDayDetails(selectedDay.dateStr, selectedDay.dayTarget, daySummaries, totalAmount, achieved);
            }}
          />
        )}
      </div>

      {/* نافذة إضافة أيام خاصة من التحديد */}
      {showAddSpecialModal && selectedDatesSorted.length > 0 && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
          onClick={() => setShowAddSpecialModal(false)}>
          <div style={{ background: 'var(--noorix-bg-surface)', borderRadius: 12, padding: 20, maxWidth: 400, width: '100%', border: '1px solid var(--noorix-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 12px', fontSize: 16 }}>{t('dashboardAddAsSpecialDays')}</h4>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--noorix-text-muted)' }}>
              {selectedDatesSorted[0]} — {selectedDatesSorted[selectedDatesSorted.length - 1]} ({selectedDatesSorted.length} {lang === 'ar' ? 'أيام' : 'days'})
            </p>
            <input
              type="text"
              value={newSpecialName}
              onChange={(e) => setNewSpecialName(e.target.value)}
              placeholder={t('dashboardSpecialDayName')}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', fontSize: 13, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="noorix-btn-nav" onClick={() => { setShowAddSpecialModal(false); setNewSpecialName(''); }}>{t('cancel')}</button>
              <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={handleAddSelectedAsSpecial}>{t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

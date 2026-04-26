/**
 * SmartChatScreen ظ¤ ╪د┘┘à╪ص╪د╪»╪س╪ر ╪د┘╪░┘â┘è╪ر
 * ┘╪│┘é ┘à╪▒╪ش╪╣┘è: ╪ث┘ê╪د┘à╪▒ ┘à╪ش┘à┘ّ╪╣╪ر╪î ╪ح╪»╪«╪د┘╪î ┘┘ê╪د┘╪░ ┘à╪▒┘â╪▓┘è╪ر╪î ╪ز╪«╪▓┘è┘ ┘à╪ص┘┘è ┘à╪╣ ┘┘╪ز╪▒.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useTranslation } from '../../i18n/useTranslation';
import { chatQuery, getExpenseLines, getEmployees, getVaults, createCustomAllowance } from '../../services/api';
import { rejectIfApiFailed } from '../../utils/apiResponse';
import { getStoredUser } from '../../services/authStore';
import { PERMISSIONS, hasPermission } from '../../constants/permissions';
import { HrQuickEntrySheet } from './HrQuickEntrySheet';
import { StaffFormModal } from '../HR/components/StaffFormModal';
import { useEmployees } from '../../hooks/useEmployees';
import ExpenseLineFormModal from '../Expenses/components/ExpenseLineFormModal';
import ExpenseFormModal from '../Expenses/components/ExpenseFormModal';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { loadChat, saveChat, filterByDate } from './chatStorage';
import './SmartChatScreen.css';
import { Button, AdaptiveSheet, Input } from '../../ui';
import { formatSaudiDateTime } from '../../utils/saudiDate';
import { KPI_RECHARTS_COLORS } from '../../constants/kpiCardTheme';

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

const CHAT_PAGE_SIZE = 6;

/** ╪ز╪▒╪ز┘è╪ذ ╪ث┘é╪│╪د┘à ┬س╪ث╪│╪خ┘╪ر ╪ش╪د┘ç╪▓╪ر┬╗ ┘┘è ╪د┘┘ Sheet */
const FAQ_SECTION_ORDER = [
  { id: 'reports', labelAr: '╪ز┘é╪د╪▒┘è╪▒ ┘ê┘à╪ج╪┤╪▒╪د╪ز', labelEn: 'Reports & metrics' },
  { id: 'compare', labelAr: '┘à┘é╪د╪▒┘╪د╪ز', labelEn: 'Comparisons' },
  { id: 'counts', labelAr: '╪ث╪╣╪»╪د╪»', labelEn: 'Counts' },
  { id: 'other', labelAr: '╪╣╪د┘à', labelEn: 'General' },
];

/**
 * ar / en = ╪د┘┘╪╡ ╪د┘┘à┘╪▒╪│┘┘ ┘┘┘ API (┘à╪╖╪د╪ذ┘é╪ر ╪د┘┘à╪╣╪د┘╪ش╪د╪ز)
 * shortAr / shortEn = ╪╣┘┘ê╪د┘ ╪د┘╪▓╪▒ ┘┘è ╪د┘┘é╪د╪خ┘à╪ر (╪د╪«╪ز┘è╪د╪▒┘è)
 * section = ┘à╪ش┘à┘ê╪╣╪ر ╪د┘╪╣╪▒╪╢ ┘┘è ╪د┘┘ Sheet
 */
const PERMANENT_QUESTIONS = [
  {
    section: 'reports',
    ar: '┘â┘à ┘à╪ذ┘è╪╣╪د╪ز ╪د┘╪│┘╪ر╪ا',
    en: 'What are annual sales?',
    shortAr: '┘à╪ذ┘è╪╣╪د╪ز ╪د┘╪│┘╪ر',
    shortEn: 'Annual sales',
    domain: (c) => c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ),
  },
  {
    section: 'reports',
    ar: '┘à╪د ╪ث╪▒╪╡╪»╪ر ╪د┘╪«╪▓╪د╪خ┘╪ا',
    en: 'What are vault balances?',
    shortAr: '╪ث╪▒╪╡╪»╪ر ╪د┘╪«╪▓╪د╪خ┘',
    shortEn: 'Vault balances',
    domain: (c) => c(PERMISSIONS.VIEW_VAULTS) || c(PERMISSIONS.VAULTS_READ),
  },
  {
    section: 'reports',
    ar: '╪ث╪╣╪╖┘┘è ┘à┘╪«╪╡ ╪د┘╪▒╪ذ╪ص ┘ê╪د┘╪«╪│╪د╪▒╪ر',
    en: 'Give me P&L summary',
    shortAr: '┘à┘╪«╪╡ ╪د┘╪▒╪ذ╪ص ┘ê╪د┘╪«╪│╪د╪▒╪ر',
    shortEn: 'P&L summary',
    domain: (c) => c(PERMISSIONS.VIEW_REPORTS) || c(PERMISSIONS.REPORTS_READ),
  },
  {
    section: 'reports',
    ar: '┘╪│╪ذ ╪د┘╪«╪د╪▒╪ش ╪╣┘┘ë ╪د┘┘à╪ذ┘è╪╣╪د╪ز (┘à╪┤╪ز╪▒┘è╪د╪ز╪î ┘à╪╡╪▒┘ê┘╪د╪ز╪î ╪د┘┘à╪ش┘à┘ê╪╣ ظ¤ ╪ص╪ز┘ë ╪ث┘à╪│)',
    en: 'Operating load vs sales: purchases %, expenses %, combined % (MTD through yesterday).',
    shortAr: '┘╪│╪ذ ╪د┘╪«╪د╪▒╪ش ╪╣┘┘ë ╪د┘┘à╪ذ┘è╪╣╪د╪ز',
    shortEn: 'Load vs sales (MTD)',
    domain: (c) =>
      (c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ)) &&
      c(PERMISSIONS.VIEW_INVOICES) &&
      c(PERMISSIONS.VIEW_VAULTS),
  },
  {
    section: 'compare',
    ar: '┘à╪ذ┘è╪╣╪د╪ز ╪د┘╪┤┘ç╪▒ ╪د┘╪ص╪د┘┘è ┘à┘é╪د╪ذ┘ ╪د┘┘à╪د╪╢┘è (┘┘╪│ ╪د┘┘╪ز╪▒╪ر)',
    en: 'This month vs last month sales (aligned partial months).',
    shortAr: '┘à╪ذ┘è╪╣╪د╪ز: ╪د┘╪ص╪د┘┘è vs ╪د┘┘à╪د╪╢┘è',
    shortEn: 'Sales: this vs last month',
    domain: (c) => c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ),
  },
  {
    section: 'counts',
    ar: '┘â┘à ╪╣╪»╪» ╪د┘┘┘ê╪د╪ز┘è╪▒╪ا',
    en: 'How many invoices?',
    shortAr: '╪╣╪»╪» ╪د┘┘┘ê╪د╪ز┘è╪▒',
    shortEn: 'Invoice count',
    domain: (c) => c(PERMISSIONS.VIEW_INVOICES) || c(PERMISSIONS.INVOICES_READ),
  },
  {
    section: 'counts',
    ar: '┘â┘à ╪╣╪»╪» ╪د┘┘à┘ê╪▒╪»┘è┘╪ا',
    en: 'How many suppliers?',
    shortAr: '╪╣╪»╪» ╪د┘┘à┘ê╪▒╪»┘è┘',
    shortEn: 'Supplier count',
    domain: (c) => c(PERMISSIONS.VIEW_SUPPLIERS) || c(PERMISSIONS.SUPPLIERS_READ),
  },
  {
    section: 'counts',
    ar: '┘â┘à ╪╣╪»╪» ╪د┘┘à┘ê╪╕┘┘è┘╪ا',
    en: 'How many employees?',
    shortAr: '╪╣╪»╪» ╪د┘┘à┘ê╪╕┘┘è┘',
    shortEn: 'Employee count',
    domain: (c) => c(PERMISSIONS.VIEW_EMPLOYEES) || c(PERMISSIONS.EMPLOYEES_READ),
  },
  { section: 'other', ar: '┘à╪│╪د╪╣╪»╪ر', en: 'Help', domain: () => true },
];

/** ╪│╪╖╪▒ ┬س╪ز╪╣╪▒┘è┘ / Definition┬╗ ┘é╪د╪ذ┘ ┘┘╪╖┘è */
function ReportDefinitionLine({ line, isAr }) {
  const [open, setOpen] = useState(false);
  const body = line.replace(/^(╪ز╪╣╪▒┘è┘|Definition):\s*/i, '').trim();
  return (
    <div className="noorix-chat-report-card__definition rounded-[10px] border border-noorix-border overflow-hidden bg-noorix-bg-page/60">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 text-[13px] font-semibold text-noorix-text py-2.5 px-3 hover:bg-noorix-bg-muted/80 transition-colors"
        style={{ direction: isAr ? 'rtl' : 'ltr' }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{isAr ? '╪ز╪╣╪▒┘è┘ ╪د┘┘à╪ج╪┤╪▒╪د╪ز' : 'Indicator definition'}</span>
        <span className="text-noorix-muted nx-ltr text-[11px]" aria-hidden>{open ? 'ظû▓' : 'ظû╝'}</span>
      </button>
      {open ? (
        <div className="text-[13px] text-noorix-muted leading-[1.65] px-3 pb-3 pt-0 border-t border-noorix-border border-opacity-60">
          {body}
        </div>
      ) : null}
    </div>
  );
}

/** ╪▒╪│┘à ╪╣┘à┘ê╪»┘è ╪ذ╪│┘è╪╖ ┘┘à┘é╪د╪▒┘╪ر ╪┤┘ç╪▒┘è┘ّ┘è┘ (╪ذ┘è╪د┘╪د╪ز ┘à┘ ╪د┘┘ API ┘┘é╪╖) */
function ChatMiniChart({ chart, isAr }) {
  const bars = chart?.bars;
  if (!Array.isArray(bars) || bars.length < 2) return null;
  const data = bars.map((b) => ({
    key: b.key,
    name: isAr ? b.labelAr : b.labelEn,
    value: Number(b.value),
  }));
  const fmt = (v) => `${Number(v).toLocaleString('en')} ${isAr ? '╪▒.╪│' : 'SAR'}`;
  return (
    <div
      className="noorix-chat-mini-chart mt-3 pt-3 border-t border-noorix-border"
      role="img"
      aria-label={isAr ? '┘à╪«╪╖╪╖ ┘à┘é╪د╪▒┘╪ر ┘à╪ذ┘è╪╣╪د╪ز ╪د┘╪┤┘ç╪▒┘è┘' : 'Bar chart comparing the two months'}
    >
      <div className="text-[11px] font-semibold text-noorix-muted mb-2" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        {isAr ? '┘à┘é╪د╪▒┘╪ر ╪ذ╪╡╪▒┘è╪ر' : 'Visual comparison'}
      </div>
      <div className="nx-ltr" style={{ width: '100%', height: 132 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--noorix-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis
              width={44}
              tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
              tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => [fmt(value), isAr ? '╪د┘┘à╪ذ┘╪║' : 'Amount']}
              labelStyle={{ direction: isAr ? 'rtl' : 'ltr' }}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid var(--noorix-border)',
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={42}>
              {data.map((_, i) => (
                <Cell
                  key={data[i].key}
                  fill={i === 0 ? KPI_RECHARTS_COLORS.purchases : KPI_RECHARTS_COLORS.sales}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** ╪┤╪▒┘è╪╖ ┘à┘â╪»┘ّ╪│: ┘à╪┤╪ز╪▒┘è╪د╪ز + ┘à╪╡╪▒┘ê┘╪د╪ز ┘â┘╪│╪ذ╪ر ┘à┘ ╪د┘┘à╪ذ┘è╪╣╪د╪ز (╪ذ┘è╪د┘╪د╪ز ┘à┘ ╪د┘┘ API) */
function ChatFinanceRatiosStrip({ chart, isAr }) {
  const segments = chart?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const used = segments.reduce((a, s) => a + (Number(s.pct) || 0), 0);
  const remainder = Math.max(0, 100 - used);
  const fillFor = (key) => (key === 'purchases' ? KPI_RECHARTS_COLORS.purchases : KPI_RECHARTS_COLORS.expenses);
  const labelFor = (key) => {
    if (key === 'purchases') return isAr ? '┘à╪┤╪ز╪▒┘è╪د╪ز' : 'Purchases';
    return isAr ? '┘à╪╡╪▒┘ê┘╪د╪ز' : 'Expenses';
  };
  return (
    <div
      className="noorix-chat-finance-ratios mt-3 pt-3 border-t border-noorix-border"
      role="img"
      aria-label={isAr ? '╪┤╪▒┘è╪╖ ┘╪│╪ذ ╪د┘╪«╪د╪▒╪ش ╪د┘╪ز╪┤╪║┘è┘┘è ┘à┘ ╪د┘┘à╪ذ┘è╪╣╪د╪ز' : 'Operating load as share of revenue'}
    >
      <div className="text-[11px] font-semibold text-noorix-muted mb-2" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        {isAr ? '╪ز┘ê╪▓┘è╪╣ ╪د┘╪«╪د╪▒╪ش ╪د┘╪ز╪┤╪║┘è┘┘è ┘à┘ ╪د┘╪ح┘è╪▒╪د╪»' : 'Operating load vs revenue'}
      </div>
      <div
        className="noorix-chat-finance-ratios__track nx-ltr flex h-[10px] rounded-full overflow-hidden border border-noorix-border/80 bg-noorix-bg-muted"
        aria-hidden
      >
        {segments.map((s) => (
          <div
            key={s.key}
            className="noorix-chat-finance-ratios__seg h-full min-w-0 transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, Number(s.pct) || 0))}%`, backgroundColor: fillFor(s.key) }}
            title={`${labelFor(s.key)}: ${Number(s.pct).toFixed(2)}%`}
          />
        ))}
        {remainder > 0.05 ? (
          <div className="noorix-chat-finance-ratios__remainder flex-1 min-w-0 h-full bg-noorix-bg-page/90" />
        ) : null}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-noorix-muted list-none m-0 p-0" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        {segments.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-sm shrink-0" style={{ backgroundColor: fillFor(s.key) }} aria-hidden />
            <span>
              {labelFor(s.key)}: <span className="font-semibold text-noorix-text nx-ltr">{Number(s.pct).toFixed(2)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** ┘â╪▒╪ز ╪د┘╪▒╪» ظ¤ ╪╣┘╪د┘ê┘è┘ ## ╪î ┘┘é╪د╪╖ ظت ╪î ╪ز╪╣╪▒┘è┘ ┘é╪د╪ذ┘ ┘┘╪╖┘è ╪î ╪س┘à ╪┤╪ذ┘â╪ر ╪ز╪│┘à┘è╪ر:┘é┘è┘à╪ر */
function ReportCard({ text, isAr, createdAt, extras }) {
  const raw = String(text || '').trim();
  const lines = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const renderKvLine = (line, i) => {
    const colonIdx = line.indexOf(':');
    const hasLabel = colonIdx > 0 && colonIdx < 50;
    const label = hasLabel ? line.slice(0, colonIdx).trim() : null;
    const value = hasLabel ? line.slice(colonIdx + 1).trim() : line;
    const isNumericValue = /^\d/.test(value) || /\d{4}-\d{2}-\d{2}/.test(value);
    const valueStyle: React.CSSProperties = isNumericValue ? { direction: 'ltr', unicodeBidi: 'isolate' } : {};
    const isPeriod = /^(╪د┘┘╪ز╪▒╪ر|Period)\s*:/i.test(line);
    return (
      <div
        key={i}
        className={`noorix-chat-report-card__grid${isPeriod ? ' noorix-chat-report-card__grid--period' : ''}`}
        style={{ direction: isAr ? 'rtl' : 'ltr' }}
      >
        {label ? (
          <>
            <span className="text-[13px] text-noorix-muted font-semibold">{label}:</span>
            <span style={valueStyle}>{value}</span>
          </>
        ) : (
          <span style={{ gridColumn: '1 / -1', ...valueStyle }}>{value || line}</span>
        )}
      </div>
    );
  };

  return (
    <div
      className="noorix-chat-report-card bg-noorix-surface text-noorix-text text-[14px] md:text-[15px] py-3.5 px-3 md:py-4 md:px-5 rounded-[14px] border border-noorix-border leading-[1.7] break-words w-full min-w-0 max-w-full"
      style={{
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {lines.length > 0 ? (
        <div className="flex flex-col gap-3 w-full min-w-0" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
          {lines.map((line, i) => {
            if (/^##\s*/.test(line)) {
              const title = line.replace(/^##\s*/, '').trim();
              return (
                <h3
                  key={i}
                  className="text-[15px] md:text-[16px] font-bold text-noorix-text tracking-tight border-b border-noorix-border pb-2 mb-0"
                >
                  {title}
                </h3>
              );
            }
            if (/^[ظت\-\*]\s*/.test(line)) {
              const t = line.replace(/^[ظت\-\*]\s*/, '').trim();
              const isSummary = /^╪د┘╪«┘╪د╪╡╪ر[:ي╝أ]/i.test(t) || /^Summary:/i.test(t);
              return (
                <div
                  key={i}
                  className={`noorix-chat-report-card__bullet flex gap-2 text-[14px] md:text-[15px] pe-1${isSummary ? ' noorix-chat-report-card__bullet--summary' : ''}`}
                >
                  <span className="text-noorix-muted shrink-0" aria-hidden>ظت</span>
                  <span className="min-w-0">{t}</span>
                </div>
              );
            }
            if (/^(╪ز╪╣╪▒┘è┘|Definition):\s*/i.test(line)) {
              return <ReportDefinitionLine key={i} line={line} isAr={isAr} />;
            }
            return renderKvLine(line, i);
          })}
        </div>
      ) : (
        <div className="whitespace-pre-wrap">{text}</div>
      )}
      {extras?.chart?.kind === 'monthCompare' ? <ChatMiniChart chart={extras.chart} isAr={isAr} /> : null}
      {extras?.chart?.kind === 'financeRatios' ? <ChatFinanceRatiosStrip chart={extras.chart} isAr={isAr} /> : null}
      {createdAt && (
        <div className="text-[12px] text-noorix-muted border-t border-noorix-border nx-ltr mt-[14px] pt-3">
          {formatSaudiDateTime(createdAt)}
        </div>
      )}
    </div>
  );
}

const CMD_GROUPS = [
  {
    id: 'employees',
    labelAr: '╪ح╪»╪د╪▒╪ر ╪د┘┘à┘ê╪╕┘┘è┘',
    labelEn: 'Employee management',
    icon: '',
    items: [
      { key: 'addEmployee', labelAr: '╪ح╪╢╪د┘╪ر ┘à┘ê╪╕┘', labelEn: 'Add employee', icon: '', canUse: (c) => (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.EMPLOYEES_WRITE) },
      { key: 'advance',   labelAr: '╪╡╪▒┘ ╪│┘┘╪ر',      labelEn: 'Pay advance',        icon: '', canUse: (c) => c(PERMISSIONS.CHAT_PRESET_ADVANCES)   || c(PERMISSIONS.HR_WRITE) || c(PERMISSIONS.EMPLOYEES_WRITE) },
      { key: 'increase',  labelAr: '╪▓┘è╪د╪»╪ر / ╪ذ╪»┘╪ر',  labelEn: 'Raise / Allowance',  icon: '', canUse: (c) => c(PERMISSIONS.CHAT_PRESET_INCREASES)  || c(PERMISSIONS.HR_WRITE) },
      { key: 'leave',     labelAr: '╪ز╪│╪ش┘è┘ ╪ح╪ش╪د╪▓╪ر',   labelEn: 'Record leave',       icon: '', canUse: (c) => c(PERMISSIONS.CHAT_PRESET_LEAVES)     || c(PERMISSIONS.HR_WRITE) },
      { key: 'deduction', labelAr: '╪ز╪│╪ش┘è┘ ╪«╪╡┘à',     labelEn: 'Record deduction',   icon: '', canUse: (c) => c(PERMISSIONS.CHAT_PRESET_DEDUCTIONS) || c(PERMISSIONS.HR_WRITE) },
    ],
  },
  {
    id: 'expenses',
    labelAr: '╪د┘┘à╪╡╪د╪▒┘è┘ ╪د┘╪س╪د╪ذ╪ز╪ر',
    labelEn: 'Fixed expenses',
    icon: '',
    items: [
      { key: 'addExpenseLine', labelAr: '╪ح╪╢╪د┘╪ر ┘à╪╡╪د╪▒┘è┘ ╪س╪د╪ذ╪ز╪ر', labelEn: 'Add fixed expenses', icon: '', canUse: (c) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE) },
      { key: 'payExpense', labelAr: '╪│╪»╪د╪» ┘à╪╡╪د╪▒┘è┘ ╪س╪د╪ذ╪ز╪ر', labelEn: 'Payment of fixed expenses', icon: '', canUse: (c) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE) },
      { key: 'editExpenseLine', labelAr: '╪ز╪╣╪»┘è┘ ┘à╪╡╪د╪▒┘è┘ ╪س╪د╪ذ╪ز╪ر', labelEn: 'Edit fixed expenses', icon: '', canUse: (c) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE) },
    ],
  },
];

export default function SmartChatScreen() {
  const { activeCompanyId } = useApp();
  const { t, lang } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [creatorName, setCreatorName] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [entryMode, setEntryMode] = useState(null);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [expenseMode, setExpenseMode] = useState(null);
  const [expenseEditLine, setExpenseEditLine] = useState(null);
  const { showToast } = useToast();
  const [visibleMessageCount, setVisibleMessageCount] = useState(CHAT_PAGE_SIZE);

  const messagesScrollRef = useRef(null);
  const skipScrollToEndRef = useRef(false);
  const inputRef = useRef(null);
  const commandsWrapRef = useRef(null);
  const commandsPanelRef = useRef(null);
  const saveTimerRef = useRef(null);

  const u = getStoredUser();
  const userName = u?.nameAr || u?.nameEn || u?.name || u?.email || '';
  const can = (p) => hasPermission(u?.role, p, u?.permissions || []);
  const { create } = useEmployees(activeCompanyId || '', { fetchEnabled: false });

  const qc = useQueryClient();
  const showFaq = can(PERMISSIONS.CHAT_PRESET_FAQ) || can(PERMISSIONS.VIEW_CHAT);
  const visibleFaqQuestions = showFaq ? PERMANENT_QUESTIONS.filter((q) => q.domain(can)) : [];
  const isAr = lang === 'ar';

  const { data: expenseLines = [] } = useQuery({
    queryKey: ['expense-lines', activeCompanyId],
    queryFn: async () => {
      const res = await getExpenseLines(activeCompanyId || '');
      return res?.data ?? (Array.isArray(res) ? res : []);
    },
    enabled: !!activeCompanyId && (expenseMode === 'editLine' || expenseMode === 'addLine' || expenseMode === 'pay'),
  });

  const filteredGroups = CMD_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => it.canUse(can)),
  })).filter((g) => g.items.length > 0);

  const quickRowCols = filteredGroups.length > 0 && showFaq ? 2 : 1;

  useEffect(() => {
    document.body.classList.add('noorix-page-smart-chat');
    return () => document.body.classList.remove('noorix-page-smart-chat');
  }, []);

  useEffect(() => {
    if (!activeCompanyId) return;
    qc.prefetchQuery({
      queryKey: ['employees', activeCompanyId, false],
      queryFn: async () => {
        const res = await getEmployees(activeCompanyId, false);
        return res?.success ? (res.data ?? []) : [];
      },
    });
    qc.prefetchQuery({
      queryKey: ['vaults', activeCompanyId, false],
      queryFn: async () => {
        const res = await getVaults(activeCompanyId, false);
        if (!res?.success) return [];
        const d = res.data;
        return Array.isArray(d) ? d : (d?.items ?? []);
      },
    });
  }, [activeCompanyId, qc]);

  useEffect(() => {
    if (!activeCompanyId) return;
    const data = loadChat(activeCompanyId);
    if (data?.messages?.length) {
      setMessages(data.messages);
      setCreatorName(data.creatorName || userName || '');
    } else {
      setMessages([]);
      setCreatorName(userName || '');
    }
  }, [activeCompanyId]);

  const addMessage = useCallback((msg) => {
    const withMeta = { ...msg, createdAt: msg.createdAt || new Date().toISOString() };
    setMessages((prev) => [...prev, withMeta]);
    if (!creatorName && userName) setCreatorName(userName);
  }, [creatorName, userName]);

  const persistChat = useCallback(() => {
    if (!activeCompanyId || !messages.length) return;
    saveChat(activeCompanyId, {
      creatorName: creatorName || userName,
      creatorId: u?.id,
      messages,
    });
  }, [activeCompanyId, messages, creatorName, userName, u?.id]);

  useEffect(() => {
    saveTimerRef.current = setTimeout(persistChat, 600);
    return () => clearTimeout(saveTimerRef.current);
  }, [messages, persistChat]);

  const filteredMessages = useMemo(() => {
    const base = dateFilter ? filterByDate(messages, dateFilter) : messages;
    return base.length > 100 ? base.slice(-100) : base;
  }, [messages, dateFilter]);

  useEffect(() => {
    setVisibleMessageCount(CHAT_PAGE_SIZE);
  }, [activeCompanyId, dateFilter]);

  const displayedMessages = useMemo(() => {
    if (filteredMessages.length <= visibleMessageCount) return filteredMessages;
    return filteredMessages.slice(-visibleMessageCount);
  }, [filteredMessages, visibleMessageCount]);

  const olderHiddenCount = filteredMessages.length - displayedMessages.length;

  const handleLoadMoreMessages = useCallback(() => {
    const el = messagesScrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    skipScrollToEndRef.current = true;
    setVisibleMessageCount((c) => c + CHAT_PAGE_SIZE);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (el) el.scrollTop += el.scrollHeight - prevScrollHeight;
        skipScrollToEndRef.current = false;
      });
    });
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      const inTrigger = commandsWrapRef.current?.contains(e.target);
      const inPanel   = commandsPanelRef.current?.contains(e.target);
      if (!inTrigger && !inPanel) setCommandsOpen(false);
    };
    document.addEventListener('pointerdown', onDoc, true);
    return () => document.removeEventListener('pointerdown', onDoc, true);
  }, []);

  useEffect(() => {
    if (skipScrollToEndRef.current) return;
    const scroller = messagesScrollRef.current;
    if (!scroller) return;
    requestAnimationFrame(() => {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
    });
  }, [displayedMessages, loading]);

  const handleSend = async (text?: string) => {
    const q = (text || input || '').trim();
    if (!q || loading) return;
    if (!activeCompanyId) {
      setMessages((prev) => [...prev, { role: 'user', text: q }, { role: 'assistant', textAr: '┘è╪▒╪ش┘ë ╪د╪«╪ز┘è╪د╪▒ ╪┤╪▒┘â╪ر ╪ث┘ê┘╪د┘ï.', textEn: 'Please select a company first.' }]);
      return;
    }
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    setCommandsOpen(false);
    setFaqOpen(false);
    try {
      const res = await chatQuery(q);
      if (res?.success && res?.data) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            textAr: res.data.answerAr,
            textEn: res.data.answerEn,
            ...(res.data.extras ? { extras: res.data.extras } : {}),
          },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', textAr: res?.error || '╪ص╪»╪س ╪«╪╖╪ث.', textEn: res?.error || 'An error occurred.' }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', textAr: '┘╪┤┘ ╪د┘╪د╪ز╪╡╪د┘.', textEn: 'Connection failed.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleCommand = (cmd) => {
    setCommandsOpen(false);
    if (cmd === 'addEmployee') {
      setAddEmployeeOpen(true);
    } else if (cmd === 'addExpenseLine') {
      setExpenseEditLine(null);
      setExpenseMode('addLine');
    } else if (cmd === 'payExpense') {
      setExpenseMode('pay');
    } else if (cmd === 'editExpenseLine') {
      setExpenseEditLine(undefined);
      setExpenseMode('editLine');
    } else if (['advance', 'leave', 'deduction', 'increase'].includes(cmd)) {
      setEntryMode(cmd);
    }
  };

  const onHrRecorded = (o) => {
    if (o?.textAr || o?.textEn) {
      addMessage({ role: 'assistant', textAr: o.textAr || o.textEn, textEn: o.textEn || o.textAr });
    }
  };

  const handleSaveEmployee = (payload) => {
    const { employeeBody, customAllowances = [] } = payload?.employeeBody ? payload : { employeeBody: payload, customAllowances: [] };
    create.mutate(employeeBody, {
      onSuccess: async (res, empBody) => {
        try {
          const empId = res?.data?.id || res?.id;
          for (const row of customAllowances) {
            if (row.nameAr && row.amount > 0) {
              const allowRes = await createCustomAllowance({
                companyId: activeCompanyId,
                employeeId: empId,
                nameAr: row.nameAr,
                amount: row.amount,
              });
              rejectIfApiFailed(allowRes, t('saveFailed'));
            }
          }
          showToast(t('employeeAdded'), 'success');
          setAddEmployeeOpen(false);
          const eb = empBody || employeeBody;
          const empName = eb?.name || eb?.nameAr || eb?.nameEn || 'ظ¤';
          const salary = Number(eb?.basicSalary ?? 0);
          addMessage({ role: 'assistant', textAr: `╪د┘┘┘ê╪╣: ╪ح╪╢╪د┘╪ر ┘à┘ê╪╕┘\n╪د┘╪د╪│┘à: ${empName}\n╪د┘┘à╪│┘à┘ë: ${eb?.jobTitle || 'ظ¤'}\n╪د┘╪▒╪د╪ز╪ذ: ${salary.toLocaleString('en')} SR`, textEn: `Type: Add employee\nName: ${empName}\nTitle: ${eb?.jobTitle || 'ظ¤'}\nSalary: ${salary.toLocaleString('en')} SAR` });
        } catch (e) {
          showToast(e?.message || t('saveFailed'), 'error');
        }
      },
      onError: (e) => showToast(e?.message || (isAr ? '┘╪┤┘ ╪د┘╪ح╪╢╪د┘╪ر' : 'Add failed'), 'error'),
    });
  };

  return (
    <div className="noorix-smart-chat-root">
      {!activeCompanyId && (
        <div className="noorix-surface-card text-center text-noorix-muted p-6 m-4">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {activeCompanyId && (
        <div className="noorix-smart-chat-sticky">
          {(filteredGroups.length > 0 || showFaq) && (
            <div
              className={`noorix-smart-chat-quick-row noorix-smart-chat-quick-row--top${quickRowCols === 1 ? ' noorix-smart-chat-quick-row--single' : ''}`}
              dir={isAr ? 'rtl' : 'ltr'}
            >
              {filteredGroups.length > 0 ? (
                <div ref={commandsWrapRef} className="noorix-smart-chat-quick-cell">
                  <Button className="noorix-chat-gradient-btn" onClick={() => setCommandsOpen((o) => !o)} aria-expanded={commandsOpen}>
                    <span className="noorix-chat-gradient-icon" aria-hidden>
                    </span>
                    <span className="truncate">{t('chatCommands')}</span>
                    <span className="noorix-chat-chev">{commandsOpen ? 'ظû▓' : 'ظû╝'}</span>
                  </Button>
                </div>
              ) : null}
              {showFaq ? (
                <div className="noorix-smart-chat-quick-cell">
                  <Button
                    className="noorix-chat-gradient-btn"
                    onClick={() => setFaqOpen(true)}
                    disabled={loading}
                  >
                    <span className="noorix-chat-gradient-icon" aria-hidden>
                    </span>
                    <span className="truncate">{isAr ? '╪ث╪│╪خ┘╪ر ╪ش╪د┘ç╪▓╪ر' : 'Suggested'}</span>
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          <header className="noorix-smart-chat-header" dir={isAr ? 'rtl' : 'ltr'}>
            <h1 className="noorix-smart-chat-title">{t('smartChat')}</h1>
            <div className="noorix-smart-chat-header-actions">
              <Input
                type="date"
                className="noorix-smart-chat-date-input"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value || '')}
                lang="en"
                title={isAr ? '╪ز╪╡┘┘è╪ر ╪ذ╪د┘╪ز╪د╪▒┘è╪«' : 'Filter by date'}
              />
              {dateFilter ? (
                <Button size="sm" onClick={() => setDateFilter('')} className="noorix-smart-chat-filter-clear">
                  {t('chatClearFilter')}
                </Button>
              ) : null}
            </div>
          </header>
        </div>
      )}

      {activeCompanyId && (
      <div className="noorix-smart-chat-card">
        <div
          className="noorix-smart-chat-messages"
          ref={messagesScrollRef}
          data-chat-scroll
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-busy={loading}
        >
          {olderHiddenCount > 0 && (
            <Button className="noorix-smart-chat-load-more" onClick={handleLoadMoreMessages}>
              {t('chatLoadMoreCount', String(olderHiddenCount))}
            </Button>
          )}
          {displayedMessages.length === 0 && (
            dateFilter ? (
              <div className="text-noorix-muted text-[14px] text-center p-6">
                {t('chatNoMessagesOnDate')}
              </div>
            ) : (
              <div className="flex-1 min-w-0 flex flex-col text-noorix-muted text-center gap-4 justify-center items-center p-8">
                <div className="text-noorix-accent-blue opacity-[0.22]" aria-hidden>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="text-[15px] max-w-[360px] leading-[1.7] opacity-70">
                  {isAr
                    ? '╪د╪│╪ز╪«╪»┘à ┬س╪د┘╪ث┘ê╪د┘à╪▒┬╗ ┘╪ح╪»╪«╪د┘ ╪د┘╪ذ┘è╪د┘╪د╪ز╪î ╪ث┘ê ┬س╪ث╪│╪خ┘╪ر ╪ش╪د┘ç╪▓╪ر┬╗ ┘┘╪د╪│╪ز┘╪│╪د╪▒╪î ╪ث┘ê ╪د┘â╪ز╪ذ ╪│╪ج╪د┘┘â ┘à╪ذ╪د╪┤╪▒╪ر.'
                    : 'Use Commands to enter data, Suggested for queries, or type your question below.'}
                </div>
              </div>
            )
          )}
          {displayedMessages.map((m, i) => (
            <div
              key={i}
              className={`noorix-chat-msg-row noorix-chat-msg-row--${m.role === 'user' ? 'user' : 'assistant'}`}
            >
              {m.role === 'user' ? (
                <div className="noorix-chat-bubble--user">
                  {m.text}
                </div>
              ) : (
                <div className="noorix-chat-bubble-assistant">
                  <ReportCard
                    text={(isAr ? m.textAr : m.textEn) || m.textAr}
                    isAr={isAr}
                    createdAt={m.createdAt}
                    extras={m.extras}
                  />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="noorix-chat-msg-row noorix-chat-msg-row--assistant">
              <div className="noorix-chat-skeleton-card" aria-hidden>
                <div className="noorix-chat-skeleton-line noorix-chat-skeleton-line--sm" />
                <div className="noorix-chat-skeleton-line" />
                <div className="noorix-chat-skeleton-line noorix-chat-skeleton-line--lg" />
              </div>
              <div className="sr-only">{isAr ? '╪ش╪د╪▒┘è ╪د┘╪ذ╪ص╪سظخ' : 'Searchingظخ'}</div>
            </div>
          )}
        </div>

        <div className="noorix-chat-input-bar">
          <Input
            ref={inputRef}
            type="text"
            className="noorix-chat-input-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void handleSend())}
            placeholder={t('chatInputPlaceholder')}
            disabled={loading || !activeCompanyId}
            aria-label={t('chatInputPlaceholder')}
          />
          <Button
            type="button"
            className="noorix-chat-send-btn"
            onClick={() => void handleSend()}
            disabled={loading || !input.trim() || !activeCompanyId}
            title={isAr ? '╪ح╪▒╪│╪د┘' : 'Send'}
            aria-label={isAr ? '╪ح╪▒╪│╪د┘' : 'Send'}
          >
            {loading ? <span className="noorix-chat-spinner" aria-hidden /> : <SendIcon />}
          </Button>
        </div>
      </div>
      )}

      {faqOpen && (
        <AdaptiveSheet open={true} onClose={() => setFaqOpen(false)} title={isAr ? '╪ث╪│╪خ┘╪ر ╪ش╪د┘ç╪▓╪ر' : 'Suggested questions'} size="md" side="start" className="smartchat-faq-drawer">
          <div className="flex flex-col gap-1 pb-2">
            {FAQ_SECTION_ORDER.map((sec) => {
              const qs = visibleFaqQuestions.filter((q) => q.section === sec.id);
              if (!qs.length) return null;
              return (
                <div key={sec.id} className="min-w-0">
                  <div
                    className="px-1 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-noorix-muted"
                    style={{ textAlign: isAr ? 'right' : 'left' }}
                  >
                    {isAr ? sec.labelAr : sec.labelEn}
                  </div>
                  <div className="flex flex-col gap-2">
                    {qs.map((q, i) => (
                      <Button
                        key={`${sec.id}-${i}`}
                        className="w-full text-[14px] md:text-[15px] justify-start py-3 px-4 font-medium leading-snug"
                        style={{ textAlign: isAr ? 'right' : 'left' }}
                        onClick={() => {
                          handleSend(isAr ? q.ar : q.en);
                          setFaqOpen(false);
                        }}
                      >
                        {isAr ? (q.shortAr || q.ar) : (q.shortEn || q.en)}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </AdaptiveSheet>
      )}

      {entryMode && activeCompanyId && (
        <HrQuickEntrySheet
          key={entryMode}
          mode={entryMode}
          companyId={activeCompanyId}
          onClose={() => setEntryMode(null)}
          onRecorded={onHrRecorded}
          variant="modal"
        />
      )}

      {addEmployeeOpen && activeCompanyId && (
        <StaffFormModal
          employee={null}
          companyId={activeCompanyId}
          onSave={handleSaveEmployee}
          onClose={() => setAddEmployeeOpen(false)}
          isSaving={create.isPending}
        />
      )}

      {expenseMode === 'addLine' && activeCompanyId && (
        <ExpenseLineFormModal
          companyId={activeCompanyId}
          editing={null}
          onClose={() => setExpenseMode(null)}
          onSaved={() => {
            invalidateOnFinancialMutation(qc);
            qc.invalidateQueries({ queryKey: ['expense-lines'] });
            setExpenseMode(null);
            showToast(isAr ? '╪ز┘à╪ز ╪ح╪╢╪د┘╪ر ╪ذ┘╪» ╪د┘┘à╪╡╪▒┘ê┘' : 'Expense line added', 'success');
            addMessage({ role: 'assistant', textAr: '╪د┘┘┘ê╪╣: ╪ح╪╢╪د┘╪ر ╪ذ┘╪» ┘à╪╡╪▒┘ê┘\n╪د┘╪ص╪د┘╪ر: ╪ز┘à╪ز ╪د┘╪ح╪╢╪د┘╪ر ╪ذ┘╪ش╪د╪ص', textEn: 'Type: Add expense line\nStatus: Added successfully' });
          }}
        />
      )}

      {expenseMode === 'pay' && activeCompanyId && (
        <ExpenseFormModal
          companyId={activeCompanyId}
          onClose={() => setExpenseMode(null)}
          onSaved={() => {
            invalidateOnFinancialMutation(qc);
            setExpenseMode(null);
            showToast(isAr ? '╪ز┘à ╪ز╪│╪ش┘è┘ ╪د┘┘à╪╡╪▒┘ê┘' : 'Expense recorded', 'success');
            addMessage({ role: 'assistant', textAr: '╪د┘┘┘ê╪╣: ╪│╪»╪د╪» ┘à╪╡╪▒┘ê┘\n╪د┘╪ص╪د┘╪ر: ╪ز┘à ╪د┘╪ز╪│╪ش┘è┘ ╪ذ┘╪ش╪د╪ص', textEn: 'Type: Expense payment\nStatus: Recorded successfully' });
          }}
        />
      )}

      {expenseMode === 'editLine' && activeCompanyId && (
        expenseEditLine === undefined ? (
          <AdaptiveSheet open={true} onClose={() => setExpenseMode(null)} title={t('chatEditFixedExpense')} size="sm" side="start" className="smartchat-expense-pick-drawer">
            <div className="flex flex-col gap-2">
              {expenseLines.filter((l) => l.isActive !== false).map((line) => (
                <Button key={line.id} className="w-full justify-start py-3 px-[14px]" style={{ textAlign: isAr ? 'right' : 'left' }} onClick={() => setExpenseEditLine(line)}>
                  {line.nameAr || line.nameEn || line.name || 'ظ¤'}
                </Button>
              ))}
            </div>
          </AdaptiveSheet>
        ) : (
          <ExpenseLineFormModal
            companyId={activeCompanyId}
            editing={expenseEditLine}
            onClose={() => { setExpenseEditLine(undefined); setExpenseMode(null); }}
            onSaved={() => {
              invalidateOnFinancialMutation(qc);
              qc.invalidateQueries({ queryKey: ['expense-lines'] });
              setExpenseEditLine(undefined);
              setExpenseMode(null);
              showToast(isAr ? '╪ز┘à ╪ز╪╣╪»┘è┘ ╪ذ┘╪» ╪د┘┘à╪╡╪▒┘ê┘' : 'Expense line updated', 'success');
              addMessage({ role: 'assistant', textAr: '╪د┘┘┘ê╪╣: ╪ز╪╣╪»┘è┘ ╪ذ┘╪» ┘à╪╡╪▒┘ê┘\n╪د┘╪ص╪د┘╪ر: ╪ز┘à ╪د┘╪ز╪╣╪»┘è┘ ╪ذ┘╪ش╪د╪ص', textEn: 'Type: Edit expense line\nStatus: Updated successfully' });
            }}
          />
        )
      )}

      <AdaptiveSheet
        open={!!(activeCompanyId && commandsOpen && filteredGroups.length > 0)}
        onClose={() => setCommandsOpen(false)}
        title={isAr ? '╪ث┘ê╪د┘à╪▒ ╪د┘┘à╪ص╪د╪»╪س╪ر' : 'Chat commands'}
        size="md"
        side="start"
        className="smartchat-commands-drawer"
      >
        <div ref={commandsPanelRef} className="noorix-chat-commands-panel-content" dir={isAr ? 'rtl' : 'ltr'}>
          {filteredGroups.map((g) => (
            <div key={g.id} className="noorix-chat-commands-group">
              <div className="noorix-chat-commands-group-label">
                {g.icon} {isAr ? g.labelAr : g.labelEn}
              </div>
              <div
                className={`noorix-chat-commands-grid${g.items.length === 1 ? ' noorix-chat-commands-grid--single' : ''}`}
              >
                {g.items.map((it) => (
                  <Button
                    key={it.key}
                    className="noorix-chat-commands-item"
                    onClick={() => handleCommand(it.key)}
                  >
                    <span aria-hidden>{it.icon}</span>
                    <span>{isAr ? it.labelAr : it.labelEn}</span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AdaptiveSheet>

    </div>
  );
}

/**
 * SmartChatScreen — المحادثة الذكية
 * نسق مرجعي: أوامر مجمّعة، إدخال، نوافذ مركزية، تخزين محلي مع فلتر.
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
import { Button, AdaptiveSheet, Input, useAdaptiveSheetNarrow } from '../../ui';
import { formatSaudiDateTime } from '../../utils/saudiDate';
import { KPI_RECHARTS_COLORS } from '../../constants/kpiCardTheme';
import { SendIcon } from './SmartChatIcons';
import { FAQ_SECTION_ORDER } from './smartChatFaq';
import { employeeKeys, expenseKeys, vaultKeys } from '../../services/queryKeys';

const CHAT_PAGE_SIZE = 6;

/**
 * ar / en = النص المُرسَل للـ API (مطابقة المعالجات)
 * shortAr / shortEn = عنوان الزر في القائمة (اختياري)
 * section = مجموعة العرض في الـ Sheet
 */
const PERMANENT_QUESTIONS = [
  {
    section: 'reports',
    ar: 'كم مبيعات السنة؟',
    en: 'What are annual sales?',
    shortAr: 'مبيعات السنة',
    shortEn: 'Annual sales',
    domain: (c: any) => c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ),
  },
  {
    section: 'reports',
    ar: 'ما أرصدة الخزائن؟',
    en: 'What are vault balances?',
    shortAr: 'أرصدة الخزائن',
    shortEn: 'Vault balances',
    domain: (c: any) => c(PERMISSIONS.VIEW_VAULTS) || c(PERMISSIONS.VAULTS_READ),
  },
  {
    section: 'reports',
    ar: 'أعطني ملخص الربح والخسارة',
    en: 'Give me P&L summary',
    shortAr: 'ملخص الربح والخسارة',
    shortEn: 'P&L summary',
    domain: (c: any) => c(PERMISSIONS.VIEW_REPORTS) || c(PERMISSIONS.REPORTS_READ),
  },
  {
    section: 'reports',
    ar: 'نسب الخارج على المبيعات (مشتريات، مصروفات، المجموع — حتى أمس)',
    en: 'Operating load vs sales: purchases %, expenses %, combined % (MTD through yesterday).',
    shortAr: 'نسب الخارج على المبيعات',
    shortEn: 'Load vs sales (MTD)',
    domain: (c: any) =>
      (c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ)) &&
      c(PERMISSIONS.VIEW_INVOICES) &&
      c(PERMISSIONS.VIEW_VAULTS),
  },
  {
    section: 'compare',
    ar: 'مبيعات الشهر الحالي مقابل الماضي (نفس الفترة)',
    en: 'This month vs last month sales (aligned partial months).',
    shortAr: 'مبيعات: الحالي vs الماضي',
    shortEn: 'Sales: this vs last month',
    domain: (c: any) => c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ),
  },
  {
    section: 'counts',
    ar: 'كم عدد الفواتير؟',
    en: 'How many invoices?',
    shortAr: 'عدد الفواتير',
    shortEn: 'Invoice count',
    domain: (c: any) => c(PERMISSIONS.VIEW_INVOICES) || c(PERMISSIONS.INVOICES_READ),
  },
  {
    section: 'counts',
    ar: 'كم عدد الموردين؟',
    en: 'How many suppliers?',
    shortAr: 'عدد الموردين',
    shortEn: 'Supplier count',
    domain: (c: any) => c(PERMISSIONS.VIEW_SUPPLIERS) || c(PERMISSIONS.SUPPLIERS_READ),
  },
  {
    section: 'counts',
    ar: 'كم عدد الموظفين؟',
    en: 'How many employees?',
    shortAr: 'عدد الموظفين',
    shortEn: 'Employee count',
    domain: (c: any) => c(PERMISSIONS.VIEW_EMPLOYEES) || c(PERMISSIONS.EMPLOYEES_READ),
  },
  { section: 'other', ar: 'مساعدة', en: 'Help', domain: () => true },
];

/** سطر «تعريف / Definition» قابل للطي */
function ReportDefinitionLine({ line, isAr }: any) {
  const [open, setOpen] = useState(false);
  const body = line.replace(/^(تعريف|Definition):\s*/i, '').trim();
  return (
    <div className="noorix-chat-report-card__definition rounded-[10px] border border-noorix-border overflow-hidden bg-noorix-bg-page/60">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 text-[13px] font-semibold text-noorix-text py-2.5 px-3 hover:bg-noorix-bg-muted/80 transition-colors"
        style={{ direction: isAr ? 'rtl' : 'ltr' }}
        onClick={() => setOpen((o: any) => !o)}
        aria-expanded={open}
      >
        <span>{isAr ? 'تعريف المؤشرات' : 'Indicator definition'}</span>
        <span className="text-noorix-muted nx-ltr text-[11px]" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div className="text-[13px] text-noorix-muted leading-[1.65] px-3 pb-3 pt-0 border-t border-noorix-border border-opacity-60">
          {body}
        </div>
      ) : null}
    </div>
  );
}

/** Simple bar chart comparing two months (API-driven). */
function ChatMiniChart({ chart, isAr }: any) {
  const bars = chart?.bars;
  if (!Array.isArray(bars) || bars.length < 2) return null;
  const data = bars.map((b: any) => ({
    key: b.key,
    name: isAr ? b.labelAr : b.labelEn,
    value: Number(b.value),
  }));
  const fmt = (v: any) => `${Number(v).toLocaleString('en')} ${isAr ? 'ر.س' : 'SAR'}`;
  return (
    <div
      className="noorix-chat-mini-chart mt-3 pt-3 border-t border-noorix-border"
      role="img"
      aria-label={isAr ? 'مخطط مقارنة مبيعات الشهرين' : 'Bar chart comparing the two months'}
    >
      <div className="text-[11px] font-semibold text-noorix-muted mb-2" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        {isAr ? 'مقارنة بصرية' : 'Visual comparison'}
      </div>
      <div className="nx-ltr" style={{ width: '100%', height: 132 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--noorix-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis
              width={44}
              tick={{ fontSize: 10, fill: 'var(--noorix-text-muted)' }}
              tickFormatter={(v: any) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: any) => [fmt(value), isAr ? 'المبلغ' : 'Amount']}
              labelStyle={{ direction: isAr ? 'rtl' : 'ltr' }}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid var(--noorix-border)',
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={42}>
              {data.map((_: any, i: any) => (
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

/** KPI strip: purchases vs expenses share of sales (API-driven). */
function ChatFinanceRatiosStrip({ chart, isAr }: any) {
  const segments = chart?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const used = segments.reduce((a: any, s: any) => a + (Number(s.pct) || 0), 0);
  const remainder = Math.max(0, 100 - used);
  const fillFor = (key: any) => (key === 'purchases' ? KPI_RECHARTS_COLORS.purchases : KPI_RECHARTS_COLORS.expenses);
  const labelFor = (key: any) => {
    if (key === 'purchases') return isAr ? 'مشتريات' : 'Purchases';
    return isAr ? 'مصروفات' : 'Expenses';
  };
  return (
    <div
      className="noorix-chat-finance-ratios mt-3 pt-3 border-t border-noorix-border"
      role="img"
      aria-label={isAr ? 'شريط نسب الخارج التشغيلي من المبيعات' : 'Operating load as share of revenue'}
    >
      <div className="text-[11px] font-semibold text-noorix-muted mb-2" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        {isAr ? 'توزيع الخارج التشغيلي من الإيراد' : 'Operating load vs revenue'}
      </div>
      <div
        className="noorix-chat-finance-ratios__track nx-ltr flex h-[10px] rounded-full overflow-hidden border border-noorix-border/80 bg-noorix-bg-muted"
        aria-hidden
      >
        {segments.map((s: any) => (
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
        {segments.map((s: any) => (
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

/** كرت الرد — عناوين ## ، نقاط • ، تعريف قابل للطي ، ثم شبكة تسمية:قيمة */
function ReportCard({ text, isAr, createdAt, extras }: any) {
  const raw = String(text || '').trim();
  const lines = raw
    .split(/\n+/)
    .map((s: any) => s.trim())
    .filter(Boolean);

  const renderKvLine = (line: any, i: any) => {
    const colonIdx = line.indexOf(':');
    const hasLabel = colonIdx > 0 && colonIdx < 50;
    const label = hasLabel ? line.slice(0, colonIdx).trim() : null;
    const value = hasLabel ? line.slice(colonIdx + 1).trim() : line;
    const isNumericValue = /^\d/.test(value) || /\d{4}-\d{2}-\d{2}/.test(value);
    const valueStyle: React.CSSProperties = isNumericValue ? { direction: 'ltr', unicodeBidi: 'isolate' } : {};
    const isPeriod = /^(الفترة|Period)\s*:/i.test(line);
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
          {lines.map((line: any, i: any) => {
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
            if (/^[•\-\*]\s*/.test(line)) {
              const t = line.replace(/^[•\-\*]\s*/, '').trim();
              const isSummary = /^الخلاصة[:：]/i.test(t) || /^Summary:/i.test(t);
              return (
                <div
                  key={i}
                  className={`noorix-chat-report-card__bullet flex gap-2 text-[14px] md:text-[15px] pe-1${isSummary ? ' noorix-chat-report-card__bullet--summary' : ''}`}
                >
                  <span className="text-noorix-muted shrink-0" aria-hidden>•</span>
                  <span className="min-w-0">{t}</span>
                </div>
              );
            }
            if (/^(تعريف|Definition):\s*/i.test(line)) {
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
    labelAr: 'إدارة الموظفين',
    labelEn: 'Employee management',
    icon: '',
    items: [
      { key: 'addEmployee', labelAr: 'إضافة موظف', labelEn: 'Add employee', icon: '', canUse: (c: any) => (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.EMPLOYEES_WRITE) },
      { key: 'advance',   labelAr: 'صرف سلفة',      labelEn: 'Pay advance',        icon: '', canUse: (c: any) => c(PERMISSIONS.CHAT_PRESET_ADVANCES)   || c(PERMISSIONS.HR_WRITE) || c(PERMISSIONS.EMPLOYEES_WRITE) },
      { key: 'increase',  labelAr: 'زيادة / بدل',  labelEn: 'Raise / Allowance',  icon: '', canUse: (c: any) => c(PERMISSIONS.CHAT_PRESET_INCREASES)  || c(PERMISSIONS.HR_WRITE) },
      { key: 'leave',     labelAr: 'تسجيل إجازة',   labelEn: 'Record leave',       icon: '', canUse: (c: any) => c(PERMISSIONS.CHAT_PRESET_LEAVES)     || c(PERMISSIONS.HR_WRITE) },
      { key: 'deduction', labelAr: 'تسجيل خصم',     labelEn: 'Record deduction',   icon: '', canUse: (c: any) => c(PERMISSIONS.CHAT_PRESET_DEDUCTIONS) || c(PERMISSIONS.HR_WRITE) },
    ],
  },
  {
    id: 'expenses',
    labelAr: 'المصاريف الثابتة',
    labelEn: 'Fixed expenses',
    icon: '',
    items: [
      { key: 'addExpenseLine', labelAr: 'إضافة مصاريف ثابتة', labelEn: 'Add fixed expenses', icon: '', canUse: (c: any) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE) },
      { key: 'payExpense', labelAr: 'سداد مصاريف ثابتة', labelEn: 'Payment of fixed expenses', icon: '', canUse: (c: any) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE) },
      { key: 'editExpenseLine', labelAr: 'تعديل مصاريف ثابتة', labelEn: 'Edit fixed expenses', icon: '', canUse: (c: any) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE) },
    ],
  },
];

/** محتوى ورقة الجوال: فلتر التاريخ + أوامر + أسئلة جاهزة */
function SmartChatMobileToolsBody({
  isAr,
  dateFilter,
  setDateFilter,
  t,
  filteredGroups,
  showFaq,
  visibleFaqQuestions,
  handleCommand,
  handleSend,
  onCloseSheet,
}: any) {
  return (
    <div className="flex flex-col gap-5 pt-1 min-w-0" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="min-w-0 space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-noorix-muted">
          {t('chatFilterByDate')}
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          <Input
            type="date"
            className="noorix-smart-chat-date-input flex-1 min-w-0 min-h-[44px]"
            value={dateFilter}
            onChange={(e: any) => setDateFilter(e.target.value || '')}
            lang="en"
            title={isAr ? 'تصفية بالتاريخ' : 'Filter by date'}
          />
          {dateFilter ? (
            <Button type="button" size="sm" className="shrink-0 min-h-[44px]" onClick={() => setDateFilter('')}>
              {t('chatClearFilter')}
            </Button>
          ) : null}
        </div>
      </section>

      {filteredGroups.length > 0 ? (
        <div className="noorix-chat-commands-panel-content min-w-0 rounded-xl overflow-hidden border border-noorix-border">
          {filteredGroups.map((g: any) => (
            <div key={g.id} className="noorix-chat-commands-group">
              <div className="noorix-chat-commands-group-label">
                {g.icon} {isAr ? g.labelAr : g.labelEn}
              </div>
              <div className={`noorix-chat-commands-grid${g.items.length === 1 ? ' noorix-chat-commands-grid--single' : ''}`}>
                {g.items.map((it: any) => (
                  <Button
                    key={it.key}
                    type="button"
                    className="noorix-chat-commands-item"
                    onClick={() => {
                      handleCommand(it.key);
                      onCloseSheet();
                    }}
                  >
                    <span aria-hidden>{it.icon}</span>
                    <span>{isAr ? it.labelAr : it.labelEn}</span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showFaq ? (
        <div className="flex flex-col gap-1 pb-2 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-noorix-muted pb-1">
            {isAr ? 'أسئلة جاهزة' : 'Suggested questions'}
          </div>
          {FAQ_SECTION_ORDER.map((sec: any) => {
            const qs = visibleFaqQuestions.filter((q: any) => q.section === sec.id);
            if (!qs.length) return null;
            return (
              <div key={sec.id} className="min-w-0">
                <div
                  className="px-1 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-noorix-muted"
                  style={{ textAlign: isAr ? 'right' : 'left' }}
                >
                  {isAr ? sec.labelAr : sec.labelEn}
                </div>
                <div className="flex flex-col gap-2">
                  {qs.map((q: any, i: any) => (
                    <Button
                      key={`${sec.id}-${i}`}
                      type="button"
                      className="w-full text-[14px] justify-start py-3 px-4 font-medium leading-snug min-h-[48px] h-auto whitespace-normal"
                      style={{ textAlign: isAr ? 'right' : 'left' }}
                      onClick={() => {
                        void handleSend(isAr ? q.ar : q.en);
                        onCloseSheet();
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
      ) : null}
    </div>
  );
}

export default function SmartChatScreen() {
  const { activeCompanyId } = useApp();
  const { t, lang } = useTranslation();
  const [messages, setMessages] = useState<any[]>([]);
  const [creatorName, setCreatorName] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<any>(null);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [expenseMode, setExpenseMode] = useState<any>(null);
  const [expenseEditLine, setExpenseEditLine] = useState<any>(null);
  const { showToast } = useToast();
  const [visibleMessageCount, setVisibleMessageCount] = useState(CHAT_PAGE_SIZE);

  const messagesScrollRef = useRef<any>(null);
  const skipScrollToEndRef = useRef(false);
  const inputRef = useRef<any>(null);
  const saveTimerRef = useRef<any>(null);

  const narrow = useAdaptiveSheetNarrow();

  const u = getStoredUser();
  const userName = u?.nameAr || u?.nameEn || u?.email || '';
  const can = (p: any) => hasPermission(u?.role, p, u?.permissions || []);
  const { create } = useEmployees(activeCompanyId || '', { fetchEnabled: false });

  const qc = useQueryClient();
  const showFaq = can(PERMISSIONS.CHAT_PRESET_FAQ) || can(PERMISSIONS.VIEW_CHAT);
  const visibleFaqQuestions = showFaq ? PERMANENT_QUESTIONS.filter((q: any) => q.domain(can)) : [];
  const isAr = lang === 'ar';

  const { data: expenseLines = [] } = useQuery({
    queryKey: expenseKeys.lines(activeCompanyId || ''),
    queryFn: async () => {
      const res = await getExpenseLines(activeCompanyId || '');
      return res?.data ?? (Array.isArray(res) ? res : []);
    },
    enabled: !!activeCompanyId && (expenseMode === 'editLine' || expenseMode === 'addLine' || expenseMode === 'pay'),
  });

  const filteredGroups = CMD_GROUPS.map((g: any) => ({
    ...g,
    items: g.items.filter((it: any) => it.canUse(can)),
  })).filter((g: any) => g.items.length > 0);

  const quickRowCols = !narrow && filteredGroups.length > 0 && showFaq ? 2 : 1;

  useEffect(() => {
    document.body.classList.add('noorix-page-smart-chat');
    return () => document.body.classList.remove('noorix-page-smart-chat');
  }, []);

  useEffect(() => {
    if (!activeCompanyId) return;
    qc.prefetchQuery({
      queryKey: employeeKeys.list(activeCompanyId, false),
      queryFn: async () => {
        const res = await getEmployees(activeCompanyId, false);
        return res?.success ? (res.data ?? []) : [];
      },
    });
    qc.prefetchQuery({
      queryKey: vaultKeys.shortActive(activeCompanyId),
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

  const addMessage = useCallback((msg: any) => {
    const withMeta = { ...msg, createdAt: msg.createdAt || new Date().toISOString() };
    setMessages((prev: any) => [...prev, withMeta]);
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
    setVisibleMessageCount((c: any) => c + CHAT_PAGE_SIZE);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (el) el.scrollTop += el.scrollHeight - prevScrollHeight;
        skipScrollToEndRef.current = false;
      });
    });
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
      setMessages((prev: any) => [...prev, { role: 'user', text: q }, { role: 'assistant', textAr: 'يرجى اختيار شركة أولاً.', textEn: 'Please select a company first.' }]);
      return;
    }
    setInput('');
    setMessages((prev: any) => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    setCommandsOpen(false);
    setFaqOpen(false);
    setMobileToolsOpen(false);
    try {
      const res = await chatQuery(q);
      if (res?.success && res?.data) {
        setMessages((prev: any) => [
          ...prev,
          {
            role: 'assistant',
            textAr: res.data.answerAr,
            textEn: res.data.answerEn,
            ...(res.data.extras ? { extras: res.data.extras } : {}),
          },
        ]);
      } else {
        setMessages((prev: any) => [...prev, { role: 'assistant', textAr: res?.error || 'حدث خطأ.', textEn: res?.error || 'An error occurred.' }]);
      }
    } catch (err: any) {
      setMessages((prev: any) => [...prev, { role: 'assistant', textAr: 'فشل الاتصال.', textEn: 'Connection failed.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleCommand = (cmd: any) => {
    setCommandsOpen(false);
    setMobileToolsOpen(false);
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

  const onHrRecorded = (o: any) => {
    if (o?.textAr || o?.textEn) {
      addMessage({ role: 'assistant', textAr: o.textAr || o.textEn, textEn: o.textEn || o.textAr });
    }
  };

  const handleSaveEmployee = (payload: any) => {
    const { employeeBody, customAllowances = [] } = payload?.employeeBody ? payload : { employeeBody: payload, customAllowances: [] };
    create.mutate(employeeBody, {
      onSuccess: async (res: any, empBody: any) => {
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
          const empName = eb?.name || eb?.nameAr || eb?.nameEn || '—';
          const salary = Number(eb?.basicSalary ?? 0);
          addMessage({ role: 'assistant', textAr: `النوع: إضافة موظف\nالاسم: ${empName}\nالمسمى: ${eb?.jobTitle || '—'}\nالراتب: ${salary.toLocaleString('en')} SR`, textEn: `Type: Add employee\nName: ${empName}\nTitle: ${eb?.jobTitle || '—'}\nSalary: ${salary.toLocaleString('en')} SAR` });
        } catch (e: any) {
          showToast(e?.message || t('saveFailed'), 'error');
        }
      },
      onError: (e: any) => showToast(e?.message || (isAr ? 'فشل الإضافة' : 'Add failed'), 'error'),
    });
  };

  return (
    <div className="noorix-smart-chat-root">
      {!activeCompanyId && (
        <div className="noorix-surface-card text-center text-noorix-muted p-6 m-4">
          {t('pleaseSelectCompany')}
        </div>
      )}

      {activeCompanyId && narrow && (
        <div className="noorix-smart-chat-sticky noorix-smart-chat-sticky--mobile-toolbar">
          <header className="noorix-smart-chat-mobile-header" dir={isAr ? 'rtl' : 'ltr'}>
            <h1 className="noorix-smart-chat-mobile-title">{t('smartChat')}</h1>
            {dateFilter ? (
              <span className="noorix-smart-chat-date-badge" title={t('chatFilterByDate')}>
                {dateFilter.slice(5).replace('-', '/')}
              </span>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="noorix-smart-chat-tools-btn shrink-0"
              onClick={() => setMobileToolsOpen(true)}
              aria-haspopup="dialog"
            >
              {t('chatToolsMenu')}
            </Button>
          </header>
        </div>
      )}

      {activeCompanyId && !narrow && (
        <div className="noorix-smart-chat-sticky">
          {(filteredGroups.length > 0 || showFaq) && (
            <div
              className={`noorix-smart-chat-quick-row noorix-smart-chat-quick-row--top${quickRowCols === 1 ? ' noorix-smart-chat-quick-row--single' : ''}`}
              dir={isAr ? 'rtl' : 'ltr'}
            >
              {filteredGroups.length > 0 ? (
                <div className="noorix-smart-chat-quick-cell">
                  <Button className="noorix-chat-gradient-btn" onClick={() => setCommandsOpen((o: any) => !o)} aria-expanded={commandsOpen}>
                    <span className="noorix-chat-gradient-icon" aria-hidden>
                    </span>
                    <span className="truncate">{t('chatCommands')}</span>
                    <span className="noorix-chat-chev">{commandsOpen ? '▾' : '▸'}</span>
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
                    <span className="truncate">{isAr ? 'أسئلة جاهزة' : 'Suggested'}</span>
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
                onChange={(e: any) => setDateFilter(e.target.value || '')}
                lang="en"
                title={isAr ? 'تصفية بالتاريخ' : 'Filter by date'}
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
                <div className="text-[15px] max-w-[min(360px,92vw)] leading-[1.7] opacity-70 px-1">
                  {isAr
                    ? narrow
                      ? 'افتح «أدوات» للفلتر والأوامر والأسئلة الجاهزة، أو اكتب سؤالك هنا.'
                      : 'استخدم «الأوامر» لإدخال البيانات، أو «أسئلة جاهزة» للاستفسار، أو اكتب سؤالك مباشرة.'
                    : narrow
                      ? 'Open Tools for filters, commands, and suggested questions, or type below.'
                      : 'Use Commands to enter data, Suggested for queries, or type your question below.'}
                </div>
              </div>
            )
          )}
          {displayedMessages.map((m: any, i: any) => (
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
              <div className="sr-only">{isAr ? 'جاري البحث…' : 'Searching…'}</div>
            </div>
          )}
        </div>

        <div className="noorix-chat-input-bar">
          <Input
            ref={inputRef}
            type="text"
            className="noorix-chat-input-field"
            value={input}
            onChange={(e: any) => setInput(e.target.value)}
            onKeyDown={(e: any) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void handleSend())}
            placeholder={t('chatInputPlaceholder')}
            disabled={loading || !activeCompanyId}
            aria-label={t('chatInputPlaceholder')}
          />
          <Button
            type="button"
            className="noorix-chat-send-btn"
            onClick={() => void handleSend()}
            disabled={loading || !input.trim() || !activeCompanyId}
            title={isAr ? 'إرسال' : 'Send'}
            aria-label={isAr ? 'إرسال' : 'Send'}
          >
            {loading ? <span className="noorix-chat-spinner" aria-hidden /> : <SendIcon />}
          </Button>
        </div>
      </div>
      )}

      {!narrow && faqOpen && (
        <AdaptiveSheet open={true} onClose={() => setFaqOpen(false)} title={isAr ? 'أسئلة جاهزة' : 'Suggested questions'} size="md" side="start" className="smartchat-faq-drawer">
          <div className="flex flex-col gap-1 pb-2">
            {FAQ_SECTION_ORDER.map((sec: any) => {
              const qs = visibleFaqQuestions.filter((q: any) => q.section === sec.id);
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
                    {qs.map((q: any, i: any) => (
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
            qc.invalidateQueries({ queryKey: expenseKeys.linesRoot() });
            setExpenseMode(null);
            showToast(isAr ? 'تمت إضافة بند المصروف' : 'Expense line added', 'success');
            addMessage({ role: 'assistant', textAr: 'النوع: إضافة بند مصروف\nالحالة: تمت الإضافة بنجاح', textEn: 'Type: Add expense line\nStatus: Added successfully' });
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
            showToast(isAr ? 'تم تسجيل المصروف' : 'Expense recorded', 'success');
            addMessage({ role: 'assistant', textAr: 'النوع: سداد مصروف\nالحالة: تم التسجيل بنجاح', textEn: 'Type: Expense payment\nStatus: Recorded successfully' });
          }}
        />
      )}

      {expenseMode === 'editLine' && activeCompanyId && (
        expenseEditLine === undefined ? (
          <AdaptiveSheet open={true} onClose={() => setExpenseMode(null)} title={t('chatEditFixedExpense')} size="sm" side={narrow ? 'bottom' : 'start'} className="smartchat-expense-pick-drawer">
            <div className="flex flex-col gap-2">
              {expenseLines.filter((l: any) => l.isActive !== false).map((line: any) => (
                <Button key={line.id} className="w-full justify-start py-3 px-[14px]" style={{ textAlign: isAr ? 'right' : 'left' }} onClick={() => setExpenseEditLine(line)}>
                  {line.nameAr || line.nameEn || line.name || '—'}
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
              qc.invalidateQueries({ queryKey: expenseKeys.linesRoot() });
              setExpenseEditLine(undefined);
              setExpenseMode(null);
              showToast(isAr ? 'تم تعديل بند المصروف' : 'Expense line updated', 'success');
              addMessage({ role: 'assistant', textAr: 'النوع: تعديل بند مصروف\nالحالة: تم التعديل بنجاح', textEn: 'Type: Edit expense line\nStatus: Updated successfully' });
            }}
          />
        )
      )}

      <AdaptiveSheet
        open={!!(activeCompanyId && !narrow && commandsOpen && filteredGroups.length > 0)}
        onClose={() => setCommandsOpen(false)}
        title={isAr ? 'أوامر المحادثة' : 'Chat commands'}
        size="md"
        side="start"
        className="smartchat-commands-drawer"
      >
        <div className="noorix-chat-commands-panel-content" dir={isAr ? 'rtl' : 'ltr'}>
          {filteredGroups.map((g: any) => (
            <div key={g.id} className="noorix-chat-commands-group">
              <div className="noorix-chat-commands-group-label">
                {g.icon} {isAr ? g.labelAr : g.labelEn}
              </div>
              <div
                className={`noorix-chat-commands-grid${g.items.length === 1 ? ' noorix-chat-commands-grid--single' : ''}`}
              >
                {g.items.map((it: any) => (
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

      {activeCompanyId && narrow && (
        <AdaptiveSheet
          open={mobileToolsOpen}
          onClose={() => setMobileToolsOpen(false)}
          title={t('chatToolsSheetTitle')}
          size="lg"
          side="bottom"
          className="smartchat-mobile-tools-sheet"
        >
          <SmartChatMobileToolsBody
            isAr={isAr}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            t={t}
            filteredGroups={filteredGroups}
            showFaq={showFaq}
            visibleFaqQuestions={visibleFaqQuestions}
            handleCommand={handleCommand}
            handleSend={handleSend}
            onCloseSheet={() => setMobileToolsOpen(false)}
          />
        </AdaptiveSheet>
      )}

    </div>
  );
}

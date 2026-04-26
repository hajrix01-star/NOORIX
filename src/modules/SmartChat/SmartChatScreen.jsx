/**
 * SmartChatScreen — المحادثة الذكية
 * نسق مرجعي: أوامر مجمّعة، إدخال، نوافذ مركزية، تخزين محلي مع فلتر.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

const CHAT_PAGE_SIZE = 6;

const PERMANENT_QUESTIONS = [
  { ar: 'كم مبيعات السنة؟', en: 'What are annual sales?', domain: (c) => c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ) },
  { ar: 'ما أرصدة الخزائن؟', en: 'What are vault balances?', domain: (c) => c(PERMISSIONS.VIEW_VAULTS) || c(PERMISSIONS.VAULTS_READ) },
  { ar: 'أعطني ملخص الربح والخسارة', en: 'Give me P&L summary', domain: (c) => c(PERMISSIONS.VIEW_REPORTS) || c(PERMISSIONS.REPORTS_READ) },
  {
    ar: 'كم نسبة المشتريات من المبيعات؟ وكم نسبة المصروفات من المبيعات؟ وكم نسبة المشتريات والمصروفات من المبيعات؟ (من أول هذا الشهر حتى اليوم)',
    en: 'Purchases % of sales, expenses % of sales, and (purchases+expenses) % of sales — month to date.',
    domain: (c) =>
      (c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ)) &&
      c(PERMISSIONS.VIEW_INVOICES) &&
      c(PERMISSIONS.VIEW_VAULTS),
  },
  {
    ar: 'قارن بين مبيعات الشهر الماضي بالحالي بنفس الفترة حتى اليوم',
    en: 'Compare last month vs this month sales for the same period to date.',
    domain: (c) => c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ),
  },
  { ar: 'كم عدد الفواتير؟', en: 'How many invoices?', domain: (c) => c(PERMISSIONS.VIEW_INVOICES) || c(PERMISSIONS.INVOICES_READ) },
  { ar: 'كم عدد الموردين؟', en: 'How many suppliers?', domain: (c) => c(PERMISSIONS.VIEW_SUPPLIERS) || c(PERMISSIONS.SUPPLIERS_READ) },
  { ar: 'كم عدد الموظفين؟', en: 'How many employees?', domain: (c) => c(PERMISSIONS.VIEW_EMPLOYEES) || c(PERMISSIONS.EMPLOYEES_READ) },
  { ar: 'مساعدة', en: 'Help', domain: () => true },
];

/** كرت احترافي للردود والتقارير — عرض سطور منفصلة (عنوان، اسم، مبلغ، إلخ) */
function ReportCard({ text, isAr, createdAt }) {
  const raw = String(text || '').trim();
  const lines = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const hasMultipleLines = lines.length > 1;
  const fallbackLines = raw.includes('—')
    ? raw.split(/\s*—\s*/).map((s) => s.trim()).filter(Boolean)
    : lines;

  const rows = hasMultipleLines ? lines : fallbackLines;

  return (
    <div
      className="noorix-chat-report-card bg-noorix-surface text-noorix-text text-[14px] md:text-[15px] py-3.5 px-3 md:py-4 md:px-5 rounded-[14px] border border-noorix-border leading-[1.7] break-words w-full min-w-0 max-w-full"
      style={{
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {rows.length > 0 ? (
        <div className="noorix-chat-report-card__grid" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
          {rows.map((line, i) => {
            const colonIdx = line.indexOf(':');
            const hasLabel = colonIdx > 0 && colonIdx < 50;
            const label = hasLabel ? line.slice(0, colonIdx).trim() : null;
            const value = hasLabel ? line.slice(colonIdx + 1).trim() : line;
            const isNumericValue = /^\d/.test(value) || /\d{4}-\d{2}-\d{2}/.test(value);
            const valueStyle = isNumericValue ? { direction: 'ltr', unicodeBidi: 'isolate' } : {};
            return (
              <React.Fragment key={i}>
                {label ? (
                  <>
                    <span className="text-[13px] text-noorix-muted font-semibold">
                      {label}:
                    </span>
                    <span style={valueStyle}>{value}</span>
                  </>
                ) : (
                  <span style={{ gridColumn: '1 / -1', ...valueStyle }}>{value || line}</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div className="whitespace-pre-wrap">{text}</div>
      )}
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
      { key: 'addEmployee', labelAr: 'إضافة موظف', labelEn: 'Add employee', icon: '', canUse: (c) => (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.EMPLOYEES_WRITE) },
      { key: 'advance',   labelAr: 'صرف سلفة',      labelEn: 'Pay advance',        icon: '', canUse: (c) => c(PERMISSIONS.CHAT_PRESET_ADVANCES)   || c(PERMISSIONS.HR_WRITE) || c(PERMISSIONS.EMPLOYEES_WRITE) },
      { key: 'increase',  labelAr: 'زيادة / بدلة',  labelEn: 'Raise / Allowance',  icon: '', canUse: (c) => c(PERMISSIONS.CHAT_PRESET_INCREASES)  || c(PERMISSIONS.HR_WRITE) },
      { key: 'leave',     labelAr: 'تسجيل إجازة',   labelEn: 'Record leave',       icon: '', canUse: (c) => c(PERMISSIONS.CHAT_PRESET_LEAVES)     || c(PERMISSIONS.HR_WRITE) },
      { key: 'deduction', labelAr: 'تسجيل خصم',     labelEn: 'Record deduction',   icon: '', canUse: (c) => c(PERMISSIONS.CHAT_PRESET_DEDUCTIONS) || c(PERMISSIONS.HR_WRITE) },
    ],
  },
  {
    id: 'expenses',
    labelAr: 'المصاريف الثابتة',
    labelEn: 'Fixed expenses',
    icon: '',
    items: [
      { key: 'addExpenseLine', labelAr: 'إضافة مصاريف ثابتة', labelEn: 'Add fixed expenses', icon: '', canUse: (c) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE) },
      { key: 'payExpense', labelAr: 'سداد مصاريف ثابتة', labelEn: 'Payment of fixed expenses', icon: '', canUse: (c) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE) },
      { key: 'editExpenseLine', labelAr: 'تعديل مصاريف ثابتة', labelEn: 'Edit fixed expenses', icon: '', canUse: (c) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE) },
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

  const handleSend = async (text) => {
    const q = (text || input || '').trim();
    if (!q || loading) return;
    if (!activeCompanyId) {
      setMessages((prev) => [...prev, { role: 'user', text: q }, { role: 'assistant', textAr: 'يرجى اختيار شركة أولاً.', textEn: 'Please select a company first.' }]);
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
        setMessages((prev) => [...prev, { role: 'assistant', textAr: res.data.answerAr, textEn: res.data.answerEn }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', textAr: res?.error || 'حدث خطأ.', textEn: res?.error || 'An error occurred.' }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', textAr: 'فشل الاتصال.', textEn: 'Connection failed.' }]);
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
          const empName = eb?.name || eb?.nameAr || eb?.nameEn || '—';
          const salary = Number(eb?.basicSalary ?? 0);
          addMessage({ role: 'assistant', textAr: `النوع: إضافة موظف\nالاسم: ${empName}\nالمسمى: ${eb?.jobTitle || '—'}\nالراتب: ${salary.toLocaleString('en')} SR`, textEn: `Type: Add employee\nName: ${empName}\nTitle: ${eb?.jobTitle || '—'}\nSalary: ${salary.toLocaleString('en')} SAR` });
        } catch (e) {
          showToast(e?.message || t('saveFailed'), 'error');
        }
      },
      onError: (e) => showToast(e?.message || (isAr ? 'فشل الإضافة' : 'Add failed'), 'error'),
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
                    <span className="noorix-chat-chev">{commandsOpen ? '▲' : '▼'}</span>
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
                onChange={(e) => setDateFilter(e.target.value || '')}
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
        <div className="noorix-smart-chat-messages" ref={messagesScrollRef} data-chat-scroll>
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
                <div className="text-[48px] opacity-25"></div>
                <div className="text-[15px] max-w-[360px] leading-[1.7] opacity-70">
                  {isAr
                    ? 'استخدم «الأوامر» لإدخال البيانات، أو «أسئلة جاهزة» للاستفسار، أو اكتب سؤالك مباشرة.'
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
                  />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className={`noorix-chat-msg-row noorix-chat-msg-row--assistant`}>
              <div className="bg-noorix-bg-muted text-[14px] text-noorix-muted gap-2 py-3 px-[18px] rounded-[18px] inline-flex items-center">
                <span className="noorix-chat-spinner w-[14px] h-[14px] border-2" style={{ borderColor: 'var(--noorix-muted-30)', borderTopColor: 'var(--noorix-text-muted)' }} />
                {isAr ? 'جاري البحث...' : 'Searching...'}
              </div>
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
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder={t('chatInputPlaceholder')}
            disabled={loading || !activeCompanyId}
            aria-label={t('chatInputPlaceholder')}
          />
          <Button
            type="button"
            className="noorix-chat-send-btn"
            onClick={() => handleSend()}
            disabled={loading || !input.trim() || !activeCompanyId}
            title={isAr ? 'إرسال' : 'Send'}
            aria-label={isAr ? 'إرسال' : 'Send'}
          >
            {loading ? <span className="noorix-chat-spinner" aria-hidden /> : <SendIcon />}
          </Button>
        </div>
      </div>
      )}

      {faqOpen && (
        <AdaptiveSheet open={true} onClose={() => setFaqOpen(false)} title={isAr ? 'أسئلة جاهزة' : 'Suggested questions'} size="md" side="start" className="smartchat-faq-drawer">
          <div className="flex flex-col gap-2">
            {visibleFaqQuestions.map((q, i) => (
              <Button key={i} className="w-full text-[15px] justify-start py-[14px] px-4" style={{ textAlign: isAr ? 'right' : 'left' }} onClick={() => { handleSend(isAr ? q.ar : q.en); setFaqOpen(false); }}>
                {isAr ? q.ar : q.en}
              </Button>
            ))}
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
          <AdaptiveSheet open={true} onClose={() => setExpenseMode(null)} title={t('chatEditFixedExpense')} size="sm" side="start" className="smartchat-expense-pick-drawer">
            <div className="flex flex-col gap-2">
              {expenseLines.filter((l) => l.isActive !== false).map((line) => (
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
              qc.invalidateQueries({ queryKey: ['expense-lines'] });
              setExpenseEditLine(undefined);
              setExpenseMode(null);
              showToast(isAr ? 'تم تعديل بند المصروف' : 'Expense line updated', 'success');
              addMessage({ role: 'assistant', textAr: 'النوع: تعديل بند مصروف\nالحالة: تم التعديل بنجاح', textEn: 'Type: Edit expense line\nStatus: Updated successfully' });
            }}
          />
        )
      )}

      <AdaptiveSheet
        open={!!(activeCompanyId && commandsOpen && filteredGroups.length > 0)}
        onClose={() => setCommandsOpen(false)}
        title={isAr ? 'أوامر المحادثة' : 'Chat commands'}
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

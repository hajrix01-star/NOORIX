/**
 * SmartChatScreen — المحادثة الذكية
 * نسق مرجعي: أوامر مجمّعة، إدخال، نوافذ مركزية، تخزين محلي مع فلتر.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { chatQuery, getExpenseLines, getEmployees, getVaults } from '../../services/api';
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
  { ar: 'كم عدد الفواتير؟', en: 'How many invoices?', domain: (c) => c(PERMISSIONS.VIEW_INVOICES) || c(PERMISSIONS.INVOICES_READ) },
  { ar: 'كم عدد الموردين؟', en: 'How many suppliers?', domain: (c) => c(PERMISSIONS.VIEW_SUPPLIERS) || c(PERMISSIONS.SUPPLIERS_READ) },
  { ar: 'كم عدد الموظفين؟', en: 'How many employees?', domain: (c) => c(PERMISSIONS.VIEW_EMPLOYEES) || c(PERMISSIONS.EMPLOYEES_READ) },
  { ar: 'مساعدة', en: 'Help', domain: () => true },
];

function ToastBanner({ message, type, isAr, onDismiss }) {
  const isError = type === 'error';
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 24,
        [isAr ? 'right' : 'left']: 24,
        padding: '12px 20px',
        borderRadius: 10,
        background: isError ? 'rgba(220,38,38,0.95)' : 'rgba(34,197,94,0.95)',
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
        zIndex: 1100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {message}
    </div>
  );
}

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
      style={{
        padding: '16px 20px',
        borderRadius: 14,
        background: 'var(--noorix-bg-surface)',
        border: '1px solid var(--noorix-border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        fontSize: 15,
        lineHeight: 1.7,
        color: 'var(--noorix-text)',
        wordBreak: 'break-word',
        minWidth: 200,
      }}
    >
      {rows.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', alignItems: 'baseline', direction: isAr ? 'rtl' : 'ltr' }}>
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
                    <span style={{ fontSize: 13, color: 'var(--noorix-text-muted)', fontWeight: 600 }}>
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
        <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
      )}
      {createdAt && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--noorix-border)', fontSize: 12, color: 'var(--noorix-text-muted)', direction: 'ltr' }}>
          {new Date(createdAt).toLocaleString('en', { dateStyle: 'short', timeStyle: 'short' })}
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
    icon: '👥',
    items: [
      { key: 'addEmployee', labelAr: 'إضافة موظف', labelEn: 'Add employee', icon: '➕', canUse: (c) => (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.EMPLOYEES_WRITE) },
      { key: 'advance', labelAr: 'خصم من الراتب (سلفة)', labelEn: 'Salary deduction (Advance)', icon: '💳', canUse: (c) => (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.INVOICES_WRITE) },
      { key: 'increase', labelAr: 'زيادة سنوية', labelEn: 'Annual increase', icon: '📈', canUse: (c) => (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.HR_WRITE) },
      { key: 'leave', labelAr: 'إجازة موظف', labelEn: 'Employee leave', icon: '📅', canUse: (c) => (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.HR_WRITE) },
      { key: 'deduction', labelAr: 'تسجيل خصم', labelEn: 'Record deduction', icon: '📉', canUse: (c) => (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.HR_WRITE) },
    ],
  },
  {
    id: 'expenses',
    labelAr: 'المصاريف الثابتة',
    labelEn: 'Fixed expenses',
    icon: '📋',
    items: [
      { key: 'addExpenseLine', labelAr: 'إضافة مصاريف ثابتة', labelEn: 'Add fixed expenses', icon: '📄', canUse: (c) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE) },
      { key: 'payExpense', labelAr: 'سداد مصاريف ثابتة', labelEn: 'Payment of fixed expenses', icon: '💵', canUse: (c) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE) },
      { key: 'editExpenseLine', labelAr: 'تعديل مصاريف ثابتة', labelEn: 'Edit fixed expenses', icon: '✏️', canUse: (c) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE) },
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
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [visibleMessageCount, setVisibleMessageCount] = useState(CHAT_PAGE_SIZE);

  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const skipScrollToEndRef = useRef(false);
  const inputRef = useRef(null);
  const commandsWrapRef = useRef(null);
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
      if (!commandsWrapRef.current?.contains(e.target)) setCommandsOpen(false);
    };
    document.addEventListener('pointerdown', onDoc, true);
    return () => document.removeEventListener('pointerdown', onDoc, true);
  }, []);

  useEffect(() => {
    if (skipScrollToEndRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
          if (res?.success === false) throw new Error(res?.error);
          const empId = res?.data?.id || res?.id;
          for (const row of customAllowances) {
            if (row.nameAr && row.amount > 0) {
              const { createCustomAllowance } = await import('../../services/api');
              await createCustomAllowance({ companyId: activeCompanyId, employeeId: empId, nameAr: row.nameAr, amount: row.amount });
            }
          }
          setToast({ visible: true, message: t('employeeAdded'), type: 'success' });
          setAddEmployeeOpen(false);
          const eb = empBody || employeeBody;
          const empName = eb?.name || eb?.nameAr || eb?.nameEn || '—';
          const salary = Number(eb?.basicSalary ?? 0);
          addMessage({ role: 'assistant', textAr: `النوع: إضافة موظف\nالاسم: ${empName}\nالمسمى: ${eb?.jobTitle || '—'}\nالراتب: ${salary.toLocaleString('en')} ﷼`, textEn: `Type: Add employee\nName: ${empName}\nTitle: ${eb?.jobTitle || '—'}\nSalary: ${salary.toLocaleString('en')} SAR` });
        } catch (e) {
          setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' });
        }
      },
      onError: (e) => setToast({ visible: true, message: e?.message || (isAr ? 'فشل الإضافة' : 'Add failed'), type: 'error' }),
    });
  };

  return (
    <div className="noorix-smart-chat-root">
      {!activeCompanyId && (
        <div className="noorix-surface-card" style={{ margin: 16, padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
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
                  <button type="button" className="noorix-chat-gradient-btn" onClick={() => setCommandsOpen((o) => !o)}>
                    <span className="noorix-chat-gradient-icon" aria-hidden>
                      ⚡
                    </span>
                    <span className="truncate">{t('chatCommands')}</span>
                    <span className="noorix-chat-chev">{commandsOpen ? '▲' : '▼'}</span>
                  </button>
                  {commandsOpen && (
                    <div className="noorix-chat-commands-panel">
                      {filteredGroups.map((g) => (
                        <div key={g.id} className="noorix-chat-commands-group">
                          <div className="noorix-chat-commands-group-label">
                            {g.icon} {isAr ? g.labelAr : g.labelEn}
                          </div>
                          <div
                            className={`noorix-chat-commands-grid${g.items.length === 1 ? ' noorix-chat-commands-grid--single' : ''}`}
                          >
                            {g.items.map((it) => (
                              <button
                                key={it.key}
                                type="button"
                                className="noorix-chat-commands-item"
                                onClick={() => handleCommand(it.key)}
                              >
                                <span aria-hidden>{it.icon}</span>
                                <span>{isAr ? it.labelAr : it.labelEn}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              {showFaq ? (
                <div className="noorix-smart-chat-quick-cell">
                  <button
                    type="button"
                    className="noorix-chat-gradient-btn"
                    onClick={() => setFaqOpen(true)}
                    disabled={loading}
                  >
                    <span className="noorix-chat-gradient-icon" aria-hidden>
                      💬
                    </span>
                    <span className="truncate">{isAr ? 'أسئلة جاهزة' : 'Suggested'}</span>
                  </button>
                </div>
              ) : null}
            </div>
          )}

          <header className="noorix-smart-chat-header" dir={isAr ? 'rtl' : 'ltr'}>
            <h1 className="noorix-smart-chat-title">{t('smartChat')}</h1>
            <div className="noorix-smart-chat-header-actions">
              <input
                type="date"
                className="noorix-smart-chat-date-input"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value || '')}
                lang="en"
                title={isAr ? 'تصفية بالتاريخ' : 'Filter by date'}
              />
              {dateFilter ? (
                <button type="button" onClick={() => setDateFilter('')} className="noorix-btn-nav noorix-smart-chat-filter-clear">
                  {t('chatClearFilter')}
                </button>
              ) : null}
            </div>
          </header>
        </div>
      )}

      {activeCompanyId && (
      <div className="noorix-smart-chat-card">
        <div className="noorix-smart-chat-messages" ref={messagesScrollRef} data-chat-scroll>
          {olderHiddenCount > 0 && (
            <button type="button" className="noorix-smart-chat-load-more" onClick={handleLoadMoreMessages}>
              {t('chatLoadMoreCount', String(olderHiddenCount))}
            </button>
          )}
          {displayedMessages.length === 0 && (
            dateFilter ? (
              <div style={{ color: 'var(--noorix-text-muted)', fontSize: 14, textAlign: 'center', padding: 24 }}>
                {t('chatNoMessagesOnDate')}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, color: 'var(--noorix-text-muted)', textAlign: 'center' }}>
                <div style={{ fontSize: 15, maxWidth: 400 }}>
                  {isAr ? 'استخدم «الأوامر» أو «أسئلة جاهزة» أعلاه، أو اكتب سؤالك في الأسفل.' : 'Use Commands or Suggested above, or type your question below.'}
                </div>
              </div>
            )
          )}
          {displayedMessages.map((m, i) => (
            <div
              key={i}
              className={`noorix-chat-msg-row noorix-chat-msg-row--${m.role === 'user' ? 'user' : 'assistant'}`}
              style={{ alignSelf: m.role === 'user' ? (isAr ? 'flex-start' : 'flex-end') : (isAr ? 'flex-end' : 'flex-start'), maxWidth: '90%' }}
            >
              {m.role === 'user' ? (
                <div
                  className="noorix-chat-bubble noorix-chat-bubble--user"
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(37,99,235,0.12)',
                    color: '#1e40af',
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
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
            <div style={{ alignSelf: isAr ? 'flex-end' : 'flex-start' }}>
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--noorix-bg-muted)', fontSize: 14, color: 'var(--noorix-text-muted)' }}>
                {isAr ? 'جاري البحث...' : 'Searching...'}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="noorix-chat-input-bar">
          <input
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
          <button
            type="button"
            className="noorix-chat-send-btn"
            onClick={() => handleSend()}
            disabled={loading || !input.trim() || !activeCompanyId}
            title={isAr ? 'إرسال' : 'Send'}
            aria-label={isAr ? 'إرسال' : 'Send'}
          >
            {loading ? <span className="noorix-chat-spinner" aria-hidden /> : <SendIcon />}
          </button>
        </div>
      </div>
      )}

      {faqOpen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setFaqOpen(false)}>
          <div className="noorix-surface-card" style={{ maxWidth: 520, width: '100%', maxHeight: 'min(80vh, 560px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{isAr ? 'أسئلة جاهزة' : 'Suggested questions'}</span>
              <button type="button" className="noorix-btn-nav" onClick={() => setFaqOpen(false)}>{isAr ? 'إغلاق' : 'Close'}</button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleFaqQuestions.map((q, i) => (
                <button key={i} type="button" className="noorix-btn-nav" style={{ textAlign: isAr ? 'right' : 'left', padding: '14px 16px', fontSize: 15 }} onClick={() => { handleSend(isAr ? q.ar : q.en); setFaqOpen(false); }}>
                  {isAr ? q.ar : q.en}
                </button>
              ))}
            </div>
          </div>
        </div>
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
            setToast({ visible: true, message: isAr ? 'تمت إضافة بند المصروف' : 'Expense line added', type: 'success' });
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
            setToast({ visible: true, message: isAr ? 'تم تسجيل المصروف' : 'Expense recorded', type: 'success' });
            addMessage({ role: 'assistant', textAr: 'النوع: سداد مصروف\nالحالة: تم التسجيل بنجاح', textEn: 'Type: Expense payment\nStatus: Recorded successfully' });
          }}
        />
      )}

      {expenseMode === 'editLine' && activeCompanyId && (
        expenseEditLine === undefined ? (
          <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setExpenseMode(null)}>
            <div className="noorix-surface-card" style={{ maxWidth: 400, width: '100%', maxHeight: '80vh', overflow: 'auto', padding: 20, borderRadius: 14 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <strong>{t('chatEditFixedExpense')}</strong>
                <button type="button" className="noorix-btn-nav" onClick={() => setExpenseMode(null)}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {expenseLines.filter((l) => l.isActive !== false).map((line) => (
                  <button key={line.id} type="button" className="noorix-btn-nav" style={{ textAlign: isAr ? 'right' : 'left', padding: '12px 14px' }} onClick={() => setExpenseEditLine(line)}>
                    {line.nameAr || line.nameEn || line.name || '—'}
                  </button>
                ))}
              </div>
            </div>
          </div>
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
              setToast({ visible: true, message: isAr ? 'تم تعديل بند المصروف' : 'Expense line updated', type: 'success' });
              addMessage({ role: 'assistant', textAr: 'النوع: تعديل بند مصروف\nالحالة: تم التعديل بنجاح', textEn: 'Type: Edit expense line\nStatus: Updated successfully' });
            }}
          />
        )
      )}

      {toast.visible && (
        <ToastBanner message={toast.message} type={toast.type} isAr={isAr} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />
      )}
    </div>
  );
}

/**
 * SmartChatScreen — المحادثة الذكية
 * نسق مرجعي: أوامر مجمّعة، إدخال، نوافذ مركزية، تخزين محلي مع فلتر.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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

/** كرت احترافي للردود والتقارير */
function ReportCard({ text, isAr, createdAt }) {
  return (
    <div
      style={{
        padding: '16px 20px',
        borderRadius: 14,
        background: 'var(--noorix-bg-surface)',
        border: '1px solid var(--noorix-border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        fontSize: 15,
        lineHeight: 1.65,
        color: 'var(--noorix-text)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {text}
      {createdAt && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--noorix-text-muted)' }}>
          {new Date(createdAt).toLocaleString(isAr ? 'ar-SA' : 'en', { dateStyle: 'short', timeStyle: 'short' })}
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
  const navigate = useNavigate();
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

  const messagesEndRef = useRef(null);
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

  const displayedMessages = useMemo(() => {
    const base = dateFilter ? filterByDate(messages, dateFilter) : messages;
    return base.length > 100 ? base.slice(-100) : base;
  }, [messages, dateFilter]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!commandsWrapRef.current?.contains(e.target)) setCommandsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
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
          addMessage({ role: 'assistant', textAr: `✅ إضافة موظف: ${empName} — ${eb?.jobTitle || '—'} — ${salary.toLocaleString('en')} ﷼`, textEn: `✅ Employee added: ${empName} — ${eb?.jobTitle || '—'} — ${salary.toLocaleString('en')} SAR` });
        } catch (e) {
          setToast({ visible: true, message: e?.message || t('saveFailed'), type: 'error' });
        }
      },
      onError: (e) => setToast({ visible: true, message: e?.message || (isAr ? 'فشل الإضافة' : 'Add failed'), type: 'error' }),
    });
  };

  const headerBg = 'linear-gradient(135deg, #1a2a47 0%, #2d3e5f 100%)';
  const headerText = '#fff';

  return (
    <div style={{ display: 'grid', gap: 0, padding: 0, maxWidth: 1000, margin: '0 auto', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ background: headerBg, color: headerText, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderRadius: '12px 12px 0 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{t('smartChat')}</h1>
          {creatorName && (
            <span style={{ fontSize: 12, opacity: 0.85 }}>{isAr ? 'بواسطة: ' : 'By: '}{creatorName}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value || '')}
            style={{
              fontSize: 12,
              padding: '8px 12px',
              minHeight: 36,
              background: 'rgba(255,255,255,0.15)',
              color: headerText,
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8,
            }}
            title={isAr ? 'تصفية بالتاريخ' : 'Filter by date'}
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="noorix-btn-nav"
              style={{ fontSize: 12, padding: '8px 12px', minHeight: 36, background: 'rgba(255,255,255,0.15)', color: headerText }}
            >
              {t('chatClearFilter')}
            </button>
          )}
        </div>
      </div>

      {!activeCompanyId && (
        <div className="noorix-surface-card" style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
          {t('pleaseSelectCompany')}
        </div>
      )}

      {activeCompanyId && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16, borderBottom: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-page)' }}>
          {/* أوامر */}
          <div ref={commandsWrapRef} style={{ position: 'relative' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--noorix-text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚡ {t('chatCommands')}
            </div>
            <button
              type="button"
              onClick={() => setCommandsOpen((o) => !o)}
              className="noorix-btn-nav"
              style={{ width: '100%', justifyContent: 'space-between', padding: '12px 14px', fontSize: 14, minHeight: 48, textAlign: isAr ? 'right' : 'left' }}
            >
              <span>{isAr ? 'اختر أمراً' : 'Choose command'}</span>
              <span>{commandsOpen ? '▲' : '▼'}</span>
            </button>
            {commandsOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  [isAr ? 'right' : 'left']: 0,
                  marginTop: 4,
                  minWidth: 280,
                  maxHeight: 360,
                  overflowY: 'auto',
                  background: 'var(--noorix-bg-surface)',
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  border: '1px solid var(--noorix-border)',
                  zIndex: 100,
                }}
              >
                {filteredGroups.map((g) => (
                  <div key={g.id} style={{ borderBottom: '1px solid var(--noorix-border)' }}>
                    <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'var(--noorix-text-muted)', background: 'var(--noorix-bg-muted)' }}>
                      {g.icon} {isAr ? g.labelAr : g.labelEn}
                    </div>
                    {g.items.map((it) => (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => handleCommand(it.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          padding: '12px 14px',
                          fontSize: 14,
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--noorix-text)',
                          cursor: 'pointer',
                          textAlign: isAr ? 'right' : 'left',
                          borderBottom: '1px solid var(--noorix-border)',
                        }}
                      >
                        <span>{it.icon}</span>
                        {isAr ? it.labelAr : it.labelEn}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* إدخال */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--noorix-text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              📁 {t('chatInput')}
            </div>
            <button
              type="button"
              onClick={() => setToast({ visible: true, message: isAr ? 'تحميل الملف — قريباً' : 'Upload — coming soon', type: 'info' })}
              className="noorix-btn-nav"
              style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 14px', fontSize: 14, minHeight: 48, gap: 8 }}
            >
              📄 {t('chatUploadFile')}
            </button>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div
        className="noorix-surface-card"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 420,
          overflow: 'hidden',
          borderRadius: 0,
          boxShadow: 'none',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {displayedMessages.length === 0 && (
            dateFilter ? (
              <div style={{ color: 'var(--noorix-text-muted)', fontSize: 14, textAlign: 'center', padding: 24 }}>
                {t('chatNoMessagesOnDate')}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, color: 'var(--noorix-text-muted)', textAlign: 'center' }}>
                <div style={{ fontSize: 15, maxWidth: 400 }}>
                  {isAr ? 'اختر من قائمة الأوامر أو اكتب سؤالك أدناه.' : 'Choose from the command list or type your question below.'}
                </div>
                {showFaq && (
                  <button
                    type="button"
                    className="noorix-btn-primary"
                    onClick={() => setFaqOpen(true)}
                    style={{ fontSize: 13, padding: '10px 18px' }}
                  >
                    {isAr ? 'الأسئلة الجاهزة' : 'Suggested questions'}
                  </button>
                )}
              </div>
            )
          )}
          {displayedMessages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === 'user' ? (isAr ? 'flex-start' : 'flex-end') : (isAr ? 'flex-end' : 'flex-start'), maxWidth: '90%' }}>
              {m.role === 'user' ? (
                <div
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
                <ReportCard
                  text={(isAr ? m.textAr : m.textEn) || m.textAr}
                  isAr={isAr}
                  createdAt={m.createdAt}
                />
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

        <div style={{ padding: 16, borderTop: '1px solid var(--noorix-border)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {showFaq && (
              <button type="button" onClick={() => setFaqOpen(true)} disabled={loading || !activeCompanyId} className="noorix-btn-nav" style={{ fontSize: 12, padding: '10px 14px', minHeight: 44 }}>
                {isAr ? 'الأسئلة' : 'Questions'}
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder={t('chatInputPlaceholder')}
              disabled={loading || !activeCompanyId}
              style={{
                flex: 1,
                minWidth: 140,
                minHeight: 44,
                padding: '12px 14px',
                fontSize: 16,
                borderRadius: 10,
                border: '1px solid var(--noorix-border)',
                background: 'var(--noorix-bg-surface)',
                color: 'var(--noorix-text)',
                fontFamily: 'inherit',
              }}
            />
            <button type="button" onClick={() => handleSend()} disabled={loading || !input.trim() || !activeCompanyId} className="noorix-btn-primary" style={{ padding: '12px 22px', minHeight: 44 }}>
              {isAr ? 'إرسال' : 'Send'}
            </button>
          </div>
        </div>
      </div>

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
            setMessages((prev) => [...prev, { role: 'assistant', textAr: '✅ تمت إضافة بند مصروف جديد.', textEn: '✅ New expense line added.' }]);
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
            addMessage({ role: 'assistant', textAr: '✅ تم تسجيل سداد مصروف.', textEn: '✅ Expense payment recorded.' });
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
              addMessage({ role: 'assistant', textAr: '✅ تم تعديل بند المصروف.', textEn: '✅ Expense line updated.' });
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

/**
 * SmartChatScreen — المحادثة الذكية
 * نسق مرجعي: أوامر مجمّعة (إدارة موظفين، مصاريف ثابتة)، إدخال، نوافذ مركزية.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { chatQuery } from '../../services/api';
import { getStoredUser } from '../../services/authStore';
import { PERMISSIONS, hasPermission } from '../../constants/permissions';
import { HrQuickEntrySheet } from './HrQuickEntrySheet';
import { StaffFormModal } from '../HR/components/StaffFormModal';
import { useEmployees } from '../../hooks/useEmployees';

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
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [entryMode, setEntryMode] = useState(null);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const commandsWrapRef = useRef(null);

  const u = getStoredUser();
  const can = (p) => hasPermission(u?.role, p, u?.permissions || []);
  const { create } = useEmployees(activeCompanyId || '', { fetchEnabled: false });

  const showFaq = can(PERMISSIONS.CHAT_PRESET_FAQ) || can(PERMISSIONS.VIEW_CHAT);
  const visibleFaqQuestions = showFaq ? PERMANENT_QUESTIONS.filter((q) => q.domain(can)) : [];
  const isAr = lang === 'ar';

  const filteredGroups = CMD_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => it.canUse(can)),
  })).filter((g) => g.items.length > 0);

  useEffect(() => {
    const onDoc = (e) => {
      if (!commandsWrapRef.current?.contains(e.target)) setCommandsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    } else if (cmd === 'addExpenseLine' || cmd === 'payExpense' || cmd === 'editExpenseLine') {
      navigate('/expenses');
    } else if (['advance', 'leave', 'deduction', 'increase'].includes(cmd)) {
      setEntryMode(cmd);
    }
  };

  const onHrRecorded = (o) => {
    if (o?.textAr || o?.textEn) {
      setMessages((prev) => [...prev, { role: 'assistant', textAr: o.textAr || o.textEn, textEn: o.textEn || o.textAr }]);
    }
  };

  const handleSaveEmployee = (payload) => {
    const { employeeBody, customAllowances = [] } = payload?.employeeBody ? payload : { employeeBody: payload, customAllowances: [] };
    create.mutate(employeeBody, {
      onSuccess: async (res) => {
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
          setMessages((prev) => [...prev, { role: 'assistant', textAr: 'تمت إضافة الموظف بنجاح.', textEn: 'Employee added successfully.' }]);
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
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{t('smartChat')}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setDateFilter((d) => (d ? '' : new Date().toISOString().slice(0, 10)))}
            className="noorix-btn-nav"
            style={{ fontSize: 12, padding: '8px 12px', minHeight: 36, background: 'rgba(255,255,255,0.15)', color: headerText, borderColor: 'rgba(255,255,255,0.3)' }}
          >
            📅 {t('chatFilterByDate')}
          </button>
          <button
            type="button"
            onClick={() => setMessages([])}
            style={{ fontSize: 12, padding: '8px 12px', minHeight: 36, background: 'rgba(220,38,38,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            🗑 {t('chatClear')}
          </button>
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
          {messages.length === 0 && (
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
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === 'user' ? (isAr ? 'flex-start' : 'flex-end') : (isAr ? 'flex-end' : 'flex-start'), maxWidth: '85%' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: m.role === 'user' ? 'rgba(37,99,235,0.12)' : 'var(--noorix-bg-muted)',
                  color: m.role === 'user' ? '#1e40af' : 'var(--noorix-text)',
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {m.role === 'user' ? m.text : (isAr ? m.textAr : m.textEn) || m.textAr}
              </div>
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

      {toast.visible && (
        <ToastBanner message={toast.message} type={toast.type} isAr={isAr} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />
      )}
    </div>
  );
}

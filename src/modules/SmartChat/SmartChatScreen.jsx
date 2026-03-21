/**
 * SmartChatScreen — المحادثة الذكية
 * أوامر سريعة (HR)، أسئلة دائمة مع صلاحيات، واستعلام حر.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { chatQuery } from '../../services/api';
import { getStoredUser } from '../../services/authStore';
import { PERMISSIONS, hasPermission } from '../../constants/permissions';

/** أسئلة دائمة: تظهر فقط بصلاحية CHAT_PRESET_FAQ + صلاحية المجال المناسب */
const PERMANENT_QUESTIONS = [
  {
    ar: 'كم مبيعات السنة؟',
    en: 'What are annual sales?',
    domain: (c) => c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ),
  },
  {
    ar: 'ما أرصدة الخزائن؟',
    en: 'What are vault balances?',
    domain: (c) => c(PERMISSIONS.VIEW_VAULTS) || c(PERMISSIONS.VAULTS_READ),
  },
  {
    ar: 'أعطني ملخص الربح والخسارة',
    en: 'Give me P&L summary',
    domain: (c) => c(PERMISSIONS.VIEW_REPORTS) || c(PERMISSIONS.REPORTS_READ),
  },
  {
    ar: 'كم عدد الفواتير؟',
    en: 'How many invoices?',
    domain: (c) => c(PERMISSIONS.VIEW_INVOICES) || c(PERMISSIONS.INVOICES_READ),
  },
  {
    ar: 'كم عدد الموردين؟',
    en: 'How many suppliers?',
    domain: (c) => c(PERMISSIONS.VIEW_SUPPLIERS) || c(PERMISSIONS.SUPPLIERS_READ),
  },
  {
    ar: 'كم عدد الموظفين؟',
    en: 'How many employees?',
    domain: (c) => c(PERMISSIONS.VIEW_EMPLOYEES) || c(PERMISSIONS.EMPLOYEES_READ),
  },
  {
    ar: 'كم عدد مسيرات الرواتب؟',
    en: 'How many payroll runs?',
    domain: (c) => c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ),
  },
  {
    ar: 'مساعدة',
    en: 'Help',
    domain: () => true,
  },
];

const HR_QUICK_COMMANDS = [
  {
    key: 'advances',
    preset: PERMISSIONS.CHAT_PRESET_ADVANCES,
    labelAr: 'سلفيات الموظفين',
    labelEn: 'Employee advances',
    queryAr: 'سلفيات الموظفين',
    queryEn: 'employee advances',
  },
  {
    key: 'leaves',
    preset: PERMISSIONS.CHAT_PRESET_LEAVES,
    labelAr: 'إجازات الموظفين',
    labelEn: 'Employee leaves',
    queryAr: 'إجازات',
    queryEn: 'leave requests',
  },
  {
    key: 'deductions',
    preset: PERMISSIONS.CHAT_PRESET_DEDUCTIONS,
    labelAr: 'خصومات الموظفين',
    labelEn: 'Employee deductions',
    queryAr: 'خصومات الموظفين',
    queryEn: 'employee deductions',
  },
];

export default function SmartChatScreen() {
  const { activeCompanyId } = useApp();
  const { t, lang } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const quickWrapRef = useRef(null);

  const u = getStoredUser();
  const can = (permission) => hasPermission(u?.role, permission, u?.permissions || []);

  const canHrData = can(PERMISSIONS.HR_READ) || can(PERMISSIONS.EMPLOYEES_READ);
  const visibleQuickCommands = HR_QUICK_COMMANDS.filter((cmd) => can(cmd.preset) && canHrData);
  const visibleFaqQuestions = can(PERMISSIONS.CHAT_PRESET_FAQ)
    ? PERMANENT_QUESTIONS.filter((q) => q.domain(can))
    : [];

  const showFaqButton = can(PERMISSIONS.CHAT_PRESET_FAQ);
  const showQuickDropdown = visibleQuickCommands.length > 0;

  useEffect(() => {
    const onDoc = (e) => {
      if (!quickWrapRef.current?.contains(e.target)) setQuickOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text) => {
    const q = (text || input || '').trim();
    if (!q || loading) return;
    if (!activeCompanyId) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: q },
        { role: 'assistant', textAr: 'يرجى اختيار شركة أولاً.', textEn: 'Please select a company first.' },
      ]);
      return;
    }

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    setQuickOpen(false);
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
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            textAr: res?.error || 'حدث خطأ في الاستعلام.',
            textEn: res?.error || 'An error occurred.',
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          textAr: 'فشل الاتصال. تحقق من الاتصال بالسيرفر.',
          textEn: 'Connection failed. Check server connection.',
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const runQuickCommand = (cmd) => {
    const q = lang === 'ar' ? cmd.queryAr : cmd.queryEn;
    handleSend(q);
    setQuickOpen(false);
  };

  return (
    <div style={{ display: 'grid', gap: 18, padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('smartChat')}</h1>
        <p style={{ marginTop: 6, color: 'var(--noorix-text-muted)', maxWidth: 600 }}>
          {lang === 'ar'
            ? 'اسأل عن المبيعات، المصروفات، الخزائن، الفواتير، الموردين، الموظفين، والتقارير. يمكنك استخدام الأوامر السريعة أو الأسئلة الجاهزة حسب صلاحياتك.'
            : 'Ask about sales, expenses, vaults, invoices, suppliers, employees, and reports. Quick commands and suggested questions depend on your permissions.'}
        </p>
      </div>

      {!activeCompanyId && (
        <div className="noorix-surface-card" style={{ padding: 20, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
          {t('pleaseSelectCompany')}
        </div>
      )}

      <div
        className="noorix-surface-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 480,
          overflow: 'hidden',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 20, color: 'var(--noorix-text-muted)', textAlign: 'center' }}>
              <div style={{ fontSize: 15, maxWidth: 420 }}>
                {lang === 'ar'
                  ? 'ابدأ بكتابة سؤالك، أو استخدم الأدوات أدناه إن ظهرت لديك.'
                  : 'Type a question or use the tools below if available.'}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? (lang === 'ar' ? 'flex-start' : 'flex-end') : (lang === 'ar' ? 'flex-end' : 'flex-start'),
                maxWidth: '85%',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: m.role === 'user' ? 'rgba(37,99,235,0.12)' : 'var(--noorix-bg-muted)',
                  color: m.role === 'user' ? '#1e40af' : 'var(--noorix-text)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {m.role === 'user' ? m.text : (lang === 'ar' ? m.textAr : m.textEn) || m.textAr}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ alignSelf: lang === 'ar' ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'var(--noorix-bg-muted)',
                  fontSize: 14,
                  color: 'var(--noorix-text-muted)',
                }}
              >
                {lang === 'ar' ? 'جاري البحث...' : 'Searching...'}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--noorix-border)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {showQuickDropdown && (
              <div ref={quickWrapRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setQuickOpen((o) => !o)}
                  disabled={loading || !activeCompanyId}
                  className="noorix-btn-nav"
                  style={{ fontSize: 12, padding: '10px 12px', whiteSpace: 'nowrap' }}
                >
                  {lang === 'ar' ? 'أوامر سريعة ▾' : 'Quick ▾'}
                </button>
                {quickOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      marginBottom: 6,
                      ...(lang === 'ar' ? { right: 0 } : { left: 0 }),
                      minWidth: 200,
                      maxHeight: 280,
                      overflowY: 'auto',
                      background: 'var(--noorix-bg-surface)',
                      border: '1px solid var(--noorix-border)',
                      borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      zIndex: 20,
                      padding: 6,
                    }}
                  >
                    {visibleQuickCommands.map((cmd) => (
                      <button
                        key={cmd.key}
                        type="button"
                        onClick={() => runQuickCommand(cmd)}
                        className="noorix-btn-nav"
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: lang === 'ar' ? 'right' : 'left',
                          fontSize: 12,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        {lang === 'ar' ? cmd.labelAr : cmd.labelEn}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {showFaqButton && (
              <button
                type="button"
                onClick={() => setFaqOpen(true)}
                disabled={loading || !activeCompanyId}
                className="noorix-btn-nav"
                style={{ fontSize: 12, padding: '10px 12px' }}
              >
                {lang === 'ar' ? 'الأسئلة' : 'Questions'}
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={lang === 'ar' ? 'اكتب سؤالك...' : 'Type your question...'}
              disabled={loading || !activeCompanyId}
              style={{
                flex: 1,
                minWidth: 160,
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid var(--noorix-border)',
                background: 'var(--noorix-bg-surface)',
                color: 'var(--noorix-text)',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || !input.trim() || !activeCompanyId}
              className="noorix-btn-primary"
              style={{ padding: '12px 24px' }}
            >
              {lang === 'ar' ? 'إرسال' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {faqOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setFaqOpen(false)}
        >
          <div
            className="noorix-surface-card"
            style={{
              maxWidth: 520,
              width: '100%',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 14,
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>
                {lang === 'ar' ? 'أسئلة جاهزة' : 'Suggested questions'}
              </span>
              <button type="button" className="noorix-btn-nav" style={{ fontSize: 12 }} onClick={() => setFaqOpen(false)}>
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleFaqQuestions.length === 0 ? (
                <div style={{ color: 'var(--noorix-text-muted)', textAlign: 'center', padding: 24 }}>
                  {lang === 'ar'
                    ? 'لا توجد أسئلة متاحة لصلاحياتك الحالية.'
                    : 'No questions match your current permissions.'}
                </div>
              ) : (
                visibleFaqQuestions.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    className="noorix-btn-nav"
                    style={{
                      textAlign: lang === 'ar' ? 'right' : 'left',
                      padding: '12px 14px',
                      fontSize: 14,
                      borderRadius: 10,
                    }}
                    onClick={() => {
                      handleSend(lang === 'ar' ? q.ar : q.en);
                      setFaqOpen(false);
                    }}
                  >
                    {lang === 'ar' ? q.ar : q.en}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

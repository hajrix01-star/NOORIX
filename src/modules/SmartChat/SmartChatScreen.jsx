/**
 * SmartChatScreen — المحادثة الذكية
 * الأوامر السريعة: إدخال (سلفة، إجازة، خصم، زيادة/بدلة) بواجهة مناسبة للجوال.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { chatQuery } from '../../services/api';
import { getStoredUser } from '../../services/authStore';
import { PERMISSIONS, hasPermission } from '../../constants/permissions';
import { HrQuickEntrySheet } from './HrQuickEntrySheet';

const PERMANENT_QUESTIONS = [
  { ar: 'كم مبيعات السنة؟', en: 'What are annual sales?', domain: (c) => c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ) },
  { ar: 'ما أرصدة الخزائن؟', en: 'What are vault balances?', domain: (c) => c(PERMISSIONS.VIEW_VAULTS) || c(PERMISSIONS.VAULTS_READ) },
  { ar: 'أعطني ملخص الربح والخسارة', en: 'Give me P&L summary', domain: (c) => c(PERMISSIONS.VIEW_REPORTS) || c(PERMISSIONS.REPORTS_READ) },
  { ar: 'كم عدد الفواتير؟', en: 'How many invoices?', domain: (c) => c(PERMISSIONS.VIEW_INVOICES) || c(PERMISSIONS.INVOICES_READ) },
  { ar: 'كم عدد الموردين؟', en: 'How many suppliers?', domain: (c) => c(PERMISSIONS.VIEW_SUPPLIERS) || c(PERMISSIONS.SUPPLIERS_READ) },
  { ar: 'كم عدد الموظفين؟', en: 'How many employees?', domain: (c) => c(PERMISSIONS.VIEW_EMPLOYEES) || c(PERMISSIONS.EMPLOYEES_READ) },
  { ar: 'كم عدد مسيرات الرواتب؟', en: 'How many payroll runs?', domain: (c) => c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ) },
  { ar: 'مساعدة', en: 'Help', domain: () => true },
];

/** إدخال: يظهر الأمر عند صلاحية الإعداد أو (قراءة HR + كتابة مناسبة) */
const HR_QUICK_COMMANDS = [
  {
    key: 'advance',
    preset: PERMISSIONS.CHAT_PRESET_ADVANCES,
    labelAr: 'صرف سلفة',
    labelEn: 'Pay advance',
    canUse: (c) =>
      (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.INVOICES_WRITE),
  },
  {
    key: 'leave',
    preset: PERMISSIONS.CHAT_PRESET_LEAVES,
    labelAr: 'تسجيل إجازة',
    labelEn: 'Add leave',
    canUse: (c) =>
      (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.HR_WRITE),
  },
  {
    key: 'deduction',
    preset: PERMISSIONS.CHAT_PRESET_DEDUCTIONS,
    labelAr: 'تسجيل خصم',
    labelEn: 'Record deduction',
    canUse: (c) =>
      (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.HR_WRITE),
  },
  {
    key: 'increase',
    preset: PERMISSIONS.CHAT_PRESET_INCREASES,
    labelAr: 'زيادة أو بدلة',
    labelEn: 'Raise or allowance',
    canUse: (c) =>
      (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.HR_WRITE),
  },
];

export default function SmartChatScreen() {
  const { activeCompanyId } = useApp();
  const { t, lang } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [entryMode, setEntryMode] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const u = getStoredUser();
  const can = (permission) => hasPermission(u?.role, permission, u?.permissions || []);

  const visibleQuickCommands = HR_QUICK_COMMANDS.filter(
    (cmd) => (can(cmd.preset) || can(PERMISSIONS.VIEW_CHAT)) && cmd.canUse(can),
  );
  const showFaqButton = can(PERMISSIONS.CHAT_PRESET_FAQ) || can(PERMISSIONS.VIEW_CHAT);
  const visibleFaqQuestions = showFaqButton
    ? PERMANENT_QUESTIONS.filter((q) => q.domain(can))
    : [];

  const showQuickButton = visibleQuickCommands.length > 0;
  const isAr = lang === 'ar';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    setFaqOpen(false);

    try {
      const res = await chatQuery(q);
      if (res?.success && res?.data) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', textAr: res.data.answerAr, textEn: res.data.answerEn },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', textAr: res?.error || 'حدث خطأ في الاستعلام.', textEn: res?.error || 'An error occurred.' },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', textAr: 'فشل الاتصال. تحقق من الاتصال بالسيرفر.', textEn: 'Connection failed. Check server connection.' },
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

  const onHrRecorded = (o) => {
    if (o?.textAr || o?.textEn) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', textAr: o.textAr || o.textEn, textEn: o.textEn || o.textAr },
      ]);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 18, padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('smartChat')}</h1>
        <p style={{ marginTop: 6, color: 'var(--noorix-text-muted)', maxWidth: 600 }}>
          {isAr
            ? 'اختر أحد الأزرار (سلفة، إجازة، خصم، زيادة) للإدخال المباشر، أو استخدم الأسئلة الجاهزة، أو اكتب سؤالك.'
            : 'Tap an action button to enter data, use suggested questions, or type your question.'}
          {typeof __BUILD_ID__ !== 'undefined' && (
            <span style={{ fontSize: 11, opacity: 0.6, marginInlineStart: 8 }} title="Build ID">({String(__BUILD_ID__).slice(0, 7)})</span>
          )}
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
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 20, color: 'var(--noorix-text-muted)', textAlign: 'center' }}>
              <div style={{ fontSize: 15, maxWidth: 420 }}>
                {isAr
                  ? 'اختر زراً أدناه (سلفة، إجازة، خصم، زيادة) أو اكتب سؤالك.'
                  : 'Tap an action button below or type your question.'}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? (isAr ? 'flex-start' : 'flex-end') : (isAr ? 'flex-end' : 'flex-start'),
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
          {showQuickButton && activeCompanyId && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 12,
                paddingBottom: 12,
                borderBottom: '1px solid var(--noorix-border)',
              }}
            >
              {visibleQuickCommands.map((cmd) => (
                <button
                  key={cmd.key}
                  type="button"
                  onClick={() => setEntryMode(cmd.key)}
                  disabled={loading}
                  className="noorix-btn-primary"
                  style={{
                    fontSize: 13,
                    padding: '10px 14px',
                    minHeight: 44,
                    touchAction: 'manipulation',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isAr ? cmd.labelAr : cmd.labelEn}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {showFaqButton && (
              <button
                type="button"
                onClick={() => setFaqOpen(true)}
                disabled={loading || !activeCompanyId}
                className="noorix-btn-nav"
                style={{ fontSize: 12, padding: '10px 14px', minHeight: 44, touchAction: 'manipulation' }}
              >
                {isAr ? 'الأسئلة' : 'Questions'}
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAr ? 'اكتب سؤالك...' : 'Type your question...'}
              disabled={loading || !activeCompanyId}
              style={{
                flex: 1,
                minWidth: 160,
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
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || !input.trim() || !activeCompanyId}
              className="noorix-btn-primary"
              style={{ padding: '12px 22px', minHeight: 44, touchAction: 'manipulation' }}
            >
              {isAr ? 'إرسال' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {faqOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
          onClick={() => setFaqOpen(false)}
        >
          <div
            className="noorix-surface-card"
            style={{ maxWidth: 520, width: '100%', maxHeight: 'min(80vh, 560px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{isAr ? 'أسئلة جاهزة' : 'Suggested questions'}</span>
              <button type="button" className="noorix-btn-nav" style={{ fontSize: 12, minHeight: 40 }} onClick={() => setFaqOpen(false)}>
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleFaqQuestions.length === 0 ? (
                <div style={{ color: 'var(--noorix-text-muted)', textAlign: 'center', padding: 24 }}>
                  {isAr ? 'لا توجد أسئلة متاحة لصلاحياتك الحالية.' : 'No questions match your current permissions.'}
                </div>
              ) : (
                visibleFaqQuestions.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    className="noorix-btn-nav"
                    style={{ textAlign: isAr ? 'right' : 'left', padding: '14px 16px', fontSize: 15, minHeight: 48, borderRadius: 10, touchAction: 'manipulation' }}
                    onClick={() => {
                      handleSend(isAr ? q.ar : q.en);
                      setFaqOpen(false);
                    }}
                  >
                    {isAr ? q.ar : q.en}
                  </button>
                ))
              )}
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
        />
      )}
    </div>
  );
}

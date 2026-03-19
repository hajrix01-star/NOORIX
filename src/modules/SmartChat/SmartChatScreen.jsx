/**
 * SmartChatScreen — المحادثة الذكية
 * استعلامات عن المبيعات، المصروفات، الخزائن، الفواتير، الموردين، الموظفين، وغيرها.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { chatQuery } from '../../services/api';

const SUGGESTED_QUESTIONS = [
  { ar: 'كم مبيعات السنة؟', en: 'What are annual sales?' },
  { ar: 'ما أرصدة الخزائن؟', en: 'What are vault balances?' },
  { ar: 'أعطني ملخص الربح والخسارة', en: 'Give me P&L summary' },
  { ar: 'كم عدد الفواتير؟', en: 'How many invoices?' },
  { ar: 'كم عدد الموردين؟', en: 'How many suppliers?' },
  { ar: 'كم عدد الموظفين؟', en: 'How many employees?' },
  { ar: 'كم عدد مسيرات الرواتب؟', en: 'How many payroll runs?' },
  { ar: 'مساعدة', en: 'Help' },
];

export default function SmartChatScreen() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const company = companies?.find((c) => c.id === activeCompanyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');

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

  return (
    <div style={{ display: 'grid', gap: 18, padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('smartChat')}</h1>
        <p style={{ marginTop: 6, color: 'var(--noorix-text-muted)', maxWidth: 600 }}>
          {lang === 'ar'
            ? 'اسأل عن المبيعات، المصروفات، الخزائن، الفواتير، الموردين، الموظفين، والتقارير.'
            : 'Ask about sales, expenses, vaults, invoices, suppliers, employees, and reports.'}
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, color: 'var(--noorix-text-muted)', textAlign: 'center' }}>
              <div style={{ fontSize: 15 }}>
                {lang === 'ar' ? 'اختر سؤالاً أو اكتب استعلامك:' : 'Choose a question or type your query:'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 560 }}>
                {SUGGESTED_QUESTIONS.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(lang === 'ar' ? s.ar : s.en)}
                    className="noorix-btn-nav"
                    style={{ fontSize: 13, padding: '8px 14px' }}
                  >
                    {lang === 'ar' ? s.ar : s.en}
                  </button>
                ))}
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
          <div style={{ display: 'flex', gap: 8 }}>
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
    </div>
  );
}

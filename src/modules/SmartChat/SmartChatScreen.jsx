/**
 * SmartChatScreen — المحادثة الذكية
 * أوامر سريعة تعرض بيانات HR من الـ API في نافذة، والأسئلة الجاهزة.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { chatQuery, getHrAdvances, getLeaves, getDeductions, getMovements, getCustomAllowances } from '../../services/api';
import { getStoredUser } from '../../services/authStore';
import { PERMISSIONS, hasPermission } from '../../constants/permissions';

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

const HR_QUICK_COMMANDS = [
  { key: 'advances', preset: PERMISSIONS.CHAT_PRESET_ADVANCES, labelAr: 'سلفيات الموظفين', labelEn: 'Employee advances' },
  { key: 'leaves', preset: PERMISSIONS.CHAT_PRESET_LEAVES, labelAr: 'إجازات الموظفين', labelEn: 'Employee leaves' },
  { key: 'deductions', preset: PERMISSIONS.CHAT_PRESET_DEDUCTIONS, labelAr: 'خصومات الموظفين', labelEn: 'Employee deductions' },
  { key: 'increases', preset: PERMISSIONS.CHAT_PRESET_INCREASES, labelAr: 'زيادات وبدلات', labelEn: 'Raises & allowances' },
];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(v, lang) {
  return num(v).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(iso, lang) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB');
  } catch {
    return '—';
  }
}

function empName(emp, lang) {
  if (!emp) return '—';
  const n = lang === 'en' ? (emp.nameEn || emp.name) : emp.name;
  return emp.employeeSerial ? `${n} (${emp.employeeSerial})` : n;
}

const th = { padding: '8px 10px', fontWeight: 700, fontSize: 12, textAlign: 'start', borderBottom: '1px solid var(--noorix-border)', whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: 12, borderBottom: '1px solid var(--noorix-border)', verticalAlign: 'top' };

function leaveTypeLabel(t, lang) {
  const ar = { annual: 'سنوية', sick: 'مرضية', unpaid: 'بدون راتب', other: 'أخرى' };
  const en = { annual: 'Annual', sick: 'Sick', unpaid: 'Unpaid', other: 'Other' };
  return lang === 'ar' ? (ar[t] || t) : (en[t] || t);
}

function leaveStatusLabel(s, lang) {
  const ar = { pending: 'معلقة', approved: 'معتمدة', rejected: 'مرفوضة' };
  const en = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
  return lang === 'ar' ? (ar[s] || s) : (en[s] || s);
}

function deductionTypeLabel(t, lang) {
  const ar = { advance: 'سلفة', penalty: 'جزاء', other: 'أخرى' };
  const en = { advance: 'Advance', penalty: 'Penalty', other: 'Other' };
  return lang === 'ar' ? (ar[t] || t) : (en[t] || t);
}

function movementTypeLabel(t, lang) {
  const ar = { promotion: 'ترقية', raise: 'زيادة', other: 'أخرى' };
  const en = { promotion: 'Promotion', raise: 'Raise', other: 'Other' };
  return lang === 'ar' ? (ar[t] || t) : (en[t] || t);
}

export default function SmartChatScreen() {
  const { activeCompanyId } = useApp();
  const { t, lang } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);

  const [hrModalKey, setHrModalKey] = useState(null);
  const [hrYear, setHrYear] = useState(() => new Date().getFullYear());
  const [hrLoading, setHrLoading] = useState(false);
  const [hrError, setHrError] = useState(null);
  const [hrAdvances, setHrAdvances] = useState([]);
  const [hrLeaves, setHrLeaves] = useState([]);
  const [hrDeductions, setHrDeductions] = useState([]);
  const [hrMovements, setHrMovements] = useState([]);
  const [hrAllowances, setHrAllowances] = useState([]);

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

  const loadHrPanel = useCallback(async () => {
    if (!activeCompanyId || !hrModalKey) return;
    setHrLoading(true);
    setHrError(null);
    try {
      if (hrModalKey === 'advances') {
        const r = await getHrAdvances(activeCompanyId, hrYear);
        if (!r.success) throw new Error(r.error || 'Error');
        const rows = Array.isArray(r.data) ? r.data : [];
        setHrAdvances(rows);
        setHrLeaves([]);
        setHrDeductions([]);
        setHrMovements([]);
        setHrAllowances([]);
      } else if (hrModalKey === 'leaves') {
        const r = await getLeaves(activeCompanyId, undefined, hrYear);
        if (!r.success) throw new Error(r.error || 'Error');
        const rows = Array.isArray(r.data) ? r.data : [];
        setHrLeaves(rows);
        setHrAdvances([]);
        setHrDeductions([]);
        setHrMovements([]);
        setHrAllowances([]);
      } else if (hrModalKey === 'deductions') {
        const r = await getDeductions(activeCompanyId, undefined);
        if (!r.success) throw new Error(r.error || 'Error');
        let rows = Array.isArray(r.data) ? r.data : [];
        const yStart = new Date(hrYear, 0, 1).getTime();
        const yEnd = new Date(hrYear + 1, 0, 1).getTime();
        rows = rows.filter((row) => {
          const ts = row.transactionDate ? new Date(row.transactionDate).getTime() : 0;
          return ts >= yStart && ts < yEnd;
        });
        setHrDeductions(rows);
        setHrAdvances([]);
        setHrLeaves([]);
        setHrMovements([]);
        setHrAllowances([]);
      } else if (hrModalKey === 'increases') {
        const [rm, ra] = await Promise.all([
          getMovements(activeCompanyId, undefined),
          getCustomAllowances(activeCompanyId, undefined),
        ]);
        if (!rm.success) throw new Error(rm.error || 'Error');
        if (!ra.success) throw new Error(ra.error || 'Error');
        let moves = Array.isArray(rm.data) ? rm.data : [];
        let allows = Array.isArray(ra.data) ? ra.data : [];
        const yStart = new Date(hrYear, 0, 1).getTime();
        const yEnd = new Date(hrYear + 1, 0, 1).getTime();
        moves = moves.filter((row) => {
          const ts = row.effectiveDate ? new Date(row.effectiveDate).getTime() : 0;
          return ts >= yStart && ts < yEnd;
        });
        allows = allows.filter((row) => {
          const ts = row.createdAt ? new Date(row.createdAt).getTime() : 0;
          return ts >= yStart && ts < yEnd;
        });
        setHrMovements(moves);
        setHrAllowances(allows);
        setHrAdvances([]);
        setHrLeaves([]);
        setHrDeductions([]);
      }
    } catch (e) {
      setHrError(e?.message || String(e));
      setHrAdvances([]);
      setHrLeaves([]);
      setHrDeductions([]);
      setHrMovements([]);
      setHrAllowances([]);
    } finally {
      setHrLoading(false);
    }
  }, [activeCompanyId, hrModalKey, hrYear]);

  useEffect(() => {
    if (hrModalKey && activeCompanyId) loadHrPanel();
  }, [hrModalKey, activeCompanyId, hrYear, loadHrPanel]);

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

  const openHrQuick = (cmd) => {
    setHrModalKey(cmd.key);
    setQuickOpen(false);
  };

  const closeHrModal = () => {
    setHrModalKey(null);
    setHrError(null);
  };

  const hrModalTitle = () => {
    const cmd = HR_QUICK_COMMANDS.find((c) => c.key === hrModalKey);
    if (!cmd) return '';
    return lang === 'ar' ? cmd.labelAr : cmd.labelEn;
  };

  const yearOptions = [];
  const cy = new Date().getFullYear();
  for (let y = cy + 1; y >= cy - 5; y -= 1) yearOptions.push(y);

  const isRtl = lang === 'ar';

  return (
    <div style={{ display: 'grid', gap: 18, padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('smartChat')}</h1>
        <p style={{ marginTop: 6, color: 'var(--noorix-text-muted)', maxWidth: 600 }}>
          {lang === 'ar'
            ? 'الأوامر السريعة تعرض قوائم من الموارد البشرية (سلف، إجازات، خصومات، زيادات). يمكنك أيضاً الأسئلة الجاهزة أو الكتابة الحرة.'
            : 'Quick commands load HR lists (advances, leaves, deductions, raises). You can also use suggested questions or free text.'}
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
                {lang === 'ar'
                  ? 'ابدأ بكتابة سؤالك، أو افتح «أوامر سريعة» لعرض بيانات الموظفين من النظام.'
                  : 'Type a question or open Quick commands to load employee data from the system.'}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? (isRtl ? 'flex-start' : 'flex-end') : (isRtl ? 'flex-end' : 'flex-start'),
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
            <div style={{ alignSelf: isRtl ? 'flex-end' : 'flex-start' }}>
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--noorix-bg-muted)', fontSize: 14, color: 'var(--noorix-text-muted)' }}>
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
                      ...(isRtl ? { right: 0 } : { left: 0 }),
                      minWidth: 220,
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
                        onClick={() => openHrQuick(cmd)}
                        className="noorix-btn-nav"
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: isRtl ? 'right' : 'left',
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
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setFaqOpen(false)}
        >
          <div
            className="noorix-surface-card"
            style={{ maxWidth: 520, width: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{lang === 'ar' ? 'أسئلة جاهزة' : 'Suggested questions'}</span>
              <button type="button" className="noorix-btn-nav" style={{ fontSize: 12 }} onClick={() => setFaqOpen(false)}>
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleFaqQuestions.length === 0 ? (
                <div style={{ color: 'var(--noorix-text-muted)', textAlign: 'center', padding: 24 }}>
                  {lang === 'ar' ? 'لا توجد أسئلة متاحة لصلاحياتك الحالية.' : 'No questions match your current permissions.'}
                </div>
              ) : (
                visibleFaqQuestions.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    className="noorix-btn-nav"
                    style={{ textAlign: isRtl ? 'right' : 'left', padding: '12px 14px', fontSize: 14, borderRadius: 10 }}
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

      {hrModalKey && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={closeHrModal}
        >
          <div
            className="noorix-surface-card"
            style={{
              maxWidth: 960,
              width: '100%',
              maxHeight: '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 14,
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--noorix-border)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{hrModalTitle()}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 12, color: 'var(--noorix-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {lang === 'ar' ? 'السنة' : 'Year'}
                  <select
                    value={hrYear}
                    onChange={(e) => setHrYear(Number(e.target.value))}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)' }}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="noorix-btn-nav" style={{ fontSize: 12 }} onClick={() => loadHrPanel()} disabled={hrLoading}>
                  {lang === 'ar' ? 'تحديث' : 'Refresh'}
                </button>
                <button type="button" className="noorix-btn-nav" style={{ fontSize: 12 }} onClick={closeHrModal}>
                  {lang === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>

            <div style={{ padding: 14, overflow: 'auto', flex: 1 }}>
              {hrLoading && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--noorix-text-muted)' }}>{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
              )}
              {!hrLoading && hrError && (
                <div style={{ color: '#b91c1c', padding: 16 }}>{hrError}</div>
              )}

              {!hrLoading && !hrError && hrModalKey === 'advances' && (
                <div style={{ overflowX: 'auto' }}>
                  {hrAdvances.length === 0 ? (
                    <div style={{ color: 'var(--noorix-text-muted)', textAlign: 'center', padding: 24 }}>{lang === 'ar' ? 'لا توجد سلف في هذه السنة.' : 'No advances for this year.'}</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', direction: isRtl ? 'rtl' : 'ltr' }}>
                      <thead>
                        <tr style={{ background: 'var(--noorix-bg-muted)' }}>
                          <th style={th}>{lang === 'ar' ? 'الموظف' : 'Employee'}</th>
                          <th style={th}>{lang === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}</th>
                          <th style={th}>{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                          <th style={th}>{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                          <th style={th}>{lang === 'ar' ? 'السبب / ملاحظات' : 'Reason / notes'}</th>
                          <th style={th}>{lang === 'ar' ? 'التسديد' : 'Settlement'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hrAdvances.map((row) => (
                          <tr key={row.id}>
                            <td style={td}>{empName(row.employee, lang)}</td>
                            <td style={td}>{row.invoiceNumber}</td>
                            <td style={td}>{fmtMoney(row.netAmount ?? row.totalAmount, lang)} ﷼</td>
                            <td style={td}>{fmtDate(row.transactionDate, lang)}</td>
                            <td style={td}>{row.notes || '—'}</td>
                            <td style={td}>
                              {row.settledAt
                                ? `${fmtDate(row.settledAt, lang)} — ${fmtMoney(row.settledAmount, lang)} ﷼`
                                : (lang === 'ar' ? 'غير مسدد بالكامل' : 'Not fully settled')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {!hrLoading && !hrError && hrModalKey === 'leaves' && (
                <div style={{ overflowX: 'auto' }}>
                  {hrLeaves.length === 0 ? (
                    <div style={{ color: 'var(--noorix-text-muted)', textAlign: 'center', padding: 24 }}>{lang === 'ar' ? 'لا توجد إجازات في هذه السنة.' : 'No leaves for this year.'}</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', direction: isRtl ? 'rtl' : 'ltr' }}>
                      <thead>
                        <tr style={{ background: 'var(--noorix-bg-muted)' }}>
                          <th style={th}>{lang === 'ar' ? 'الموظف' : 'Employee'}</th>
                          <th style={th}>{lang === 'ar' ? 'النوع' : 'Type'}</th>
                          <th style={th}>{lang === 'ar' ? 'من' : 'From'}</th>
                          <th style={th}>{lang === 'ar' ? 'إلى' : 'To'}</th>
                          <th style={th}>{lang === 'ar' ? 'الأيام' : 'Days'}</th>
                          <th style={th}>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                          <th style={th}>{lang === 'ar' ? 'ملاحظات' : 'Notes'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hrLeaves.map((row) => (
                          <tr key={row.id}>
                            <td style={td}>{empName(row.employee, lang)}</td>
                            <td style={td}>{leaveTypeLabel(row.leaveType, lang)}</td>
                            <td style={td}>{fmtDate(row.startDate, lang)}</td>
                            <td style={td}>{fmtDate(row.endDate, lang)}</td>
                            <td style={td}>{row.daysCount}</td>
                            <td style={td}>{leaveStatusLabel(row.status, lang)}</td>
                            <td style={td}>{row.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {!hrLoading && !hrError && hrModalKey === 'deductions' && (
                <div style={{ overflowX: 'auto' }}>
                  {hrDeductions.length === 0 ? (
                    <div style={{ color: 'var(--noorix-text-muted)', textAlign: 'center', padding: 24 }}>{lang === 'ar' ? 'لا توجد خصومات في هذه السنة.' : 'No deductions for this year.'}</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', direction: isRtl ? 'rtl' : 'ltr' }}>
                      <thead>
                        <tr style={{ background: 'var(--noorix-bg-muted)' }}>
                          <th style={th}>{lang === 'ar' ? 'الموظف' : 'Employee'}</th>
                          <th style={th}>{lang === 'ar' ? 'نوع الخصم' : 'Type'}</th>
                          <th style={th}>{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                          <th style={th}>{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                          <th style={th}>{lang === 'ar' ? 'ملاحظات' : 'Notes'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hrDeductions.map((row) => (
                          <tr key={row.id}>
                            <td style={td}>{empName(row.employee, lang)}</td>
                            <td style={td}>{deductionTypeLabel(row.deductionType, lang)}</td>
                            <td style={td}>{fmtMoney(row.amount, lang)} ﷼</td>
                            <td style={td}>{fmtDate(row.transactionDate, lang)}</td>
                            <td style={td}>{row.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {!hrLoading && !hrError && hrModalKey === 'increases' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>{lang === 'ar' ? 'ترقيات وزيادات' : 'Promotions & raises'}</div>
                    <div style={{ overflowX: 'auto' }}>
                      {hrMovements.length === 0 ? (
                        <div style={{ color: 'var(--noorix-text-muted)', padding: 12 }}>{lang === 'ar' ? 'لا سجلات في هذه السنة.' : 'No records for this year.'}</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', direction: isRtl ? 'rtl' : 'ltr' }}>
                          <thead>
                            <tr style={{ background: 'var(--noorix-bg-muted)' }}>
                              <th style={th}>{lang === 'ar' ? 'الموظف' : 'Employee'}</th>
                              <th style={th}>{lang === 'ar' ? 'النوع' : 'Type'}</th>
                              <th style={th}>{lang === 'ar' ? 'مبلغ' : 'Amount'}</th>
                              <th style={th}>{lang === 'ar' ? 'قبل / بعد' : 'Before / after'}</th>
                              <th style={th}>{lang === 'ar' ? 'تاريخ النفاذ' : 'Effective'}</th>
                              <th style={th}>{lang === 'ar' ? 'ملاحظات' : 'Notes'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hrMovements.map((row) => (
                              <tr key={row.id}>
                                <td style={td}>{empName(row.employee, lang)}</td>
                                <td style={td}>{movementTypeLabel(row.movementType, lang)}</td>
                                <td style={td}>{row.amount != null ? `${fmtMoney(row.amount, lang)} ﷼` : '—'}</td>
                                <td style={td}>
                                  {[row.previousValue, row.newValue].filter(Boolean).join(' → ') || '—'}
                                </td>
                                <td style={td}>{fmtDate(row.effectiveDate, lang)}</td>
                                <td style={td}>{row.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>{lang === 'ar' ? 'بدلات إضافية' : 'Custom allowances'}</div>
                    <div style={{ overflowX: 'auto' }}>
                      {hrAllowances.length === 0 ? (
                        <div style={{ color: 'var(--noorix-text-muted)', padding: 12 }}>{lang === 'ar' ? 'لا بدلات في هذه السنة.' : 'No allowances for this year.'}</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', direction: isRtl ? 'rtl' : 'ltr' }}>
                          <thead>
                            <tr style={{ background: 'var(--noorix-bg-muted)' }}>
                              <th style={th}>{lang === 'ar' ? 'الموظف' : 'Employee'}</th>
                              <th style={th}>{lang === 'ar' ? 'اسم البدلة' : 'Allowance'}</th>
                              <th style={th}>{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                              <th style={th}>{lang === 'ar' ? 'تاريخ الإضافة' : 'Added'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hrAllowances.map((row) => (
                              <tr key={row.id}>
                                <td style={td}>{empName(row.employee, lang)}</td>
                                <td style={td}>{row.nameAr || '—'}</td>
                                <td style={td}>{fmtMoney(row.amount, lang)} ﷼</td>
                                <td style={td}>{fmtDate(row.createdAt, lang)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

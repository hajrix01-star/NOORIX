/**
 * BankStatementAnalysisScreen — التقارير التحليلية الشهرية
 *
 * التصميم الاحترافي:
 * - رفع كشف شهري لكل بنك
 * - حفظ القالب عند أول تحليل ناجح — تحاليل لاحقة تلقائية
 * - اقتراح ذكي (Gemini) مع عرض أخطاء واضح
 * - رسوم بيانية ومقارنة مع مبيعات قنوات البنك
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useVaults } from '../../hooks/useVaults';
import { importExcelRaw } from '../../utils/exportUtils';
import { parseDate, parseNumber } from '../../utils/importTemplates';
import {
  fetchAllSalesSummariesForExport,
  analyzeBankStatementStructure,
  getHealth,
  getBankStatementTemplates,
  createBankStatementTemplate,
  deleteBankStatementTemplate,
} from '../../services/api';
import { fmt } from '../../utils/format';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const STORAGE_CATEGORIES = 'noorix_bank_statement_categories';

const COL_TYPES = [
  { key: 'ignore', labelKey: 'bankStatementColIgnore' },
  { key: 'date', labelKey: 'bankStatementColDate' },
  { key: 'debit', labelKey: 'bankStatementColDebit' },
  { key: 'credit', labelKey: 'bankStatementColCredit' },
  { key: 'amount', labelKey: 'bankStatementColAmount' },
  { key: 'description', labelKey: 'bankStatementColDescription' },
  { key: 'balance', labelKey: 'bankStatementColBalance' },
];

function loadCategories() {
  try {
    const raw = localStorage.getItem(STORAGE_CATEGORIES);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [
    { id: 'salaries', nameAr: 'رواتب', nameEn: 'Salaries', color: '#6366f1' },
    { id: 'rent', nameAr: 'إيجار', nameEn: 'Rent', color: '#f97316' },
    { id: 'utilities', nameAr: 'مرافق', nameEn: 'Utilities', color: '#22c55e' },
    { id: 'supplies', nameAr: 'مستلزمات', nameEn: 'Supplies', color: '#0ea5e9' },
    { id: 'transfers', nameAr: 'تحويلات', nameEn: 'Transfers', color: '#8b5cf6' },
    { id: 'other', nameAr: 'أخرى', nameEn: 'Other', color: '#64748b' },
  ];
}

function saveCategories(cats) {
  try {
    localStorage.setItem(STORAGE_CATEGORIES, JSON.stringify(cats));
  } catch (_) {}
}

function getMonthsForYear(year) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      value: `${year}-${String(m).padStart(2, '0')}`,
      labelAr: new Date(year, i, 1).toLocaleDateString('ar-SA', { month: 'long' }),
      labelEn: new Date(year, i, 1).toLocaleDateString('en-US', { month: 'long' }),
    };
  });
}

export default function BankStatementAnalysisScreen() {
  const { activeCompanyId } = useApp();
  const { t, lang } = useTranslation();
  const { salesChannels } = useVaults({ companyId: activeCompanyId });
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const defaultMonth = `${currentYear}-${currentMonth}`;

  const [step, setStep] = useState('setup');
  const [reportMonth, setReportMonth] = useState(defaultMonth);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [bankNameForNew, setBankNameForNew] = useState('');
  const [file, setFile] = useState(null);
  const [rawGrid, setRawGrid] = useState([]);
  const [colCount, setColCount] = useState(0);
  const [dataStartRow, setDataStartRow] = useState(0);
  const [dataEndRow, setDataEndRow] = useState(0);
  const [columnTypes, setColumnTypes] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(loadCategories);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState(false);
  const [aiMeta, setAiMeta] = useState(null); // { companyName, reportDate, headerRow }
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateSuccess, setSaveTemplateSuccess] = useState(false);

  const fileInputRef = React.useRef(null);

  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await getHealth();
      return res?.data ?? res;
    },
  });
  const geminiAvailable = !!healthData?.geminiAvailable;

  const { data: templatesData } = useQuery({
    queryKey: ['bank-statement-templates', activeCompanyId],
    queryFn: () => getBankStatementTemplates(activeCompanyId),
    enabled: !!activeCompanyId,
  });
  const templates = templatesData?.data ?? [];

  const createTemplateMutation = useMutation({
    mutationFn: (body) => createBankStatementTemplate(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-statement-templates', activeCompanyId] });
      setSaveTemplateSuccess(true);
      setTimeout(() => setSaveTemplateSuccess(false), 3000);
    },
  });

  const selectedTemplate = templates.find((tp) => tp.id === selectedTemplateId);

  const handleFileSelect = useCallback(
    async (e) => {
      const f = e?.target?.files?.[0];
      if (!f) return;
      setUploadError('');
      setAiError('');
      if (!/\.(xlsx|xls)$/i.test(f.name)) {
        setUploadError(
          lang === 'ar' ? 'يرجى رفع ملف Excel (.xlsx أو .xls)' : 'Please upload an Excel file (.xlsx or .xls)',
        );
        return;
      }
      try {
        const { raw, colCount: cols } = await importExcelRaw(f);
        if (!raw?.length) {
          setUploadError(lang === 'ar' ? 'الملف فارغ أو بدون صفوف' : 'File is empty or has no rows');
          return;
        }
        setFile(f);
        setRawGrid(raw);
        setColCount(cols);
        setDataEndRow(raw.length - 1);

        if (selectedTemplate && selectedTemplate.colCount === cols) {
          setDataStartRow(selectedTemplate.dataStartRow);
          setDataEndRow(selectedTemplate.dataEndRow);
          const types = {};
          Object.entries(selectedTemplate.columnTypes || {}).forEach(([k, v]) => {
            types[Number(k)] = String(v || 'ignore');
          });
          setColumnTypes(types);
        } else {
          setDataStartRow(0);
          setDataEndRow(raw.length - 1);
          setColumnTypes({});
        }
        setStep('preview');
      } catch (err) {
        setUploadError(err?.message || (lang === 'ar' ? 'فشل قراءة الملف' : 'Failed to read file'));
      }
    },
    [lang, selectedTemplate],
  );

  const handleAISuggest = useCallback(async () => {
    if (!rawGrid?.length) return;
    setAiLoading(true);
    setAiError('');
    setAiSuccess(false);
    setAiMeta(null);
    try {
      const rawForApi = rawGrid.map((row) =>
        Array.from({ length: colCount }, (_, i) => String(row[i] ?? '')),
      );
      const res = await analyzeBankStatementStructure(rawForApi);
      if (res?.success && res?.data) {
        const d = res.data;
        const start = d.dataStartRow ?? 0;
        const end = d.dataEndRow ?? rawGrid.length - 1;
        setDataStartRow(start);
        setDataEndRow(end);
        const types = {};
        Object.entries(d.columnTypes || {}).forEach(([k, v]) => {
          types[Number(k)] = String(v || 'ignore');
        });
        setColumnTypes(types);
        if (d.companyName || d.reportDate) {
          setAiMeta({
            companyName: d.companyName || '',
            reportDate: d.reportDate || '',
            headerRow: d.headerRow,
          });
        }
        setAiSuccess(true);
        setTimeout(() => setAiSuccess(false), 5000);
      } else {
        setAiError(res?.error || (lang === 'ar' ? 'لم يتمكن الذكاء من التحليل' : 'AI could not analyze'));
      }
    } catch (err) {
      setAiError(err?.message || (lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error'));
    } finally {
      setAiLoading(false);
    }
  }, [rawGrid, colCount, lang]);

  const applyFromPreview = useCallback(() => {
    const dateCol = Object.entries(columnTypes).find(([, v]) => v === 'date')?.[0];
    const debitCol = Object.entries(columnTypes).find(([, v]) => v === 'debit')?.[0];
    const creditCol = Object.entries(columnTypes).find(([, v]) => v === 'credit')?.[0];
    const amountCol = Object.entries(columnTypes).find(([, v]) => v === 'amount')?.[0];
    const descCol = Object.entries(columnTypes).find(([, v]) => v === 'description')?.[0];
    const balanceCol = Object.entries(columnTypes).find(([, v]) => v === 'balance')?.[0];

    const hasAmount = debitCol != null || creditCol != null || amountCol != null;
    if (!dateCol || !hasAmount) return;

    const start = Math.max(0, dataStartRow);
    const end = Math.min(rawGrid.length - 1, dataEndRow);

    const mapped = [];
    for (let i = start; i <= end; i++) {
      const row = rawGrid[i] || [];
      const dateVal = row[Number(dateCol)];
      const debitVal = debitCol != null ? parseNumber(row[Number(debitCol)]) : null;
      const creditVal = creditCol != null ? parseNumber(row[Number(creditCol)]) : null;
      const amountVal = amountCol != null ? parseNumber(row[Number(amountCol)]) : null;
      const desc = descCol != null ? String(row[Number(descCol)] ?? '').trim() : '';
      const balanceVal = balanceCol != null ? row[Number(balanceCol)] : null;

      const date = parseDate(dateVal);
      let amount = null;
      if (amountVal != null && amountVal !== 0) amount = amountVal;
      else if (debitVal != null && debitVal > 0) amount = -debitVal;
      else if (creditVal != null && creditVal > 0) amount = creditVal;
      else if (debitVal != null && debitVal !== 0) amount = -Math.abs(debitVal);
      else if (creditVal != null && creditVal !== 0) amount = Math.abs(creditVal);

      if (date && amount != null && amount !== 0) {
        mapped.push({
          id: `row-${i}`,
          transactionDate: date,
          amount: Number(amount),
          description: desc,
          balance: balanceVal != null ? parseNumber(balanceVal) : null,
          categoryId: null,
        });
      }
    }

    setTransactions(mapped);
    setSaveTemplateName(
      selectedTemplate?.bankName || bankNameForNew || (lang === 'ar' ? 'بنك غير محدد' : 'Unnamed bank'),
    );
    setStep('analysis');
  }, [rawGrid, columnTypes, dataStartRow, dataEndRow, selectedTemplate, bankNameForNew, lang]);

  const handleSaveTemplate = useCallback(() => {
    const name = (saveTemplateName || '').trim();
    if (!name || !activeCompanyId) return;
    createTemplateMutation.mutate({
      companyId: activeCompanyId,
      bankName: name,
      columnTypes,
      dataStartRow,
      dataEndRow,
      colCount,
    });
  }, [saveTemplateName, activeCompanyId, columnTypes, dataStartRow, dataEndRow, colCount, createTemplateMutation]);

  const updateTransactionCategory = useCallback((id, categoryId) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, categoryId } : t)));
  }, []);

  const addCategory = useCallback(() => {
    const name = (newCategoryName || '').trim();
    if (!name) return;
    const id = `cat-${Date.now()}`;
    const color = ['#6366f1', '#22c55e', '#f97316', '#0ea5e9', '#e11d48', '#8b5cf6'][
      categories.length % 6
    ];
    const cat = { id, nameAr: name, nameEn: name, color };
    setCategories((prev) => {
      const next = [...prev, cat];
      saveCategories(next);
      return next;
    });
    setNewCategoryName('');
  }, [newCategoryName, categories.length]);

  const removeCategory = useCallback((id) => {
    setCategories((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveCategories(next);
      return next;
    });
  }, []);

  const categoryName = (cat, lng) =>
    (lng === 'en' ? cat?.nameEn || cat?.nameAr : cat?.nameAr || cat?.nameEn) || '—';

  const byCategory = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      const cid = t.categoryId || '__uncategorized';
      if (!map[cid]) map[cid] = { categoryId: cid, total: 0, count: 0 };
      map[cid].total += t.amount;
      map[cid].count += 1;
    });
    return Object.values(map).map((x) => ({
      ...x,
      name:
        x.categoryId === '__uncategorized'
          ? t('uncategorized')
          : categoryName(
              categories.find((c) => c.id === x.categoryId),
              lang,
            ),
      fill:
        x.categoryId === '__uncategorized'
          ? '#94a3b8'
          : categories.find((c) => c.id === x.categoryId)?.color || '#94a3b8',
    }));
  }, [transactions, categories, lang, t]);

  const byMonth = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      const ym = t.transactionDate?.slice(0, 7);
      if (!ym) return;
      if (!map[ym]) map[ym] = { month: ym, credits: 0, debits: 0 };
      if (t.amount >= 0) map[ym].credits += t.amount;
      else map[ym].debits += Math.abs(t.amount);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions]);

  const dateRange = useMemo(() => {
    const dates = transactions.map((t) => t.transactionDate).filter(Boolean);
    if (!dates.length) return null;
    const sorted = [...dates].sort();
    return { start: sorted[0], end: sorted[sorted.length - 1] };
  }, [transactions]);

  const { data: salesData } = useQuery({
    queryKey: ['bank-statement-compare', activeCompanyId, dateRange?.start, dateRange?.end],
    queryFn: async () => {
      if (!activeCompanyId || !dateRange) return [];
      const items = await fetchAllSalesSummariesForExport(
        activeCompanyId,
        dateRange.start,
        dateRange.end,
      );
      return Array.isArray(items) ? items : [];
    },
    enabled: !!activeCompanyId && !!dateRange && !!dateRange.start && !!dateRange.end,
  });

  const bankSalesChannels = useMemo(
    () => salesChannels.filter((v) => v.type === 'bank'),
    [salesChannels],
  );

  const salesByDate = useMemo(() => {
    const map = {};
    const items = Array.isArray(salesData) ? salesData : [];
    items.forEach((s) => {
      const dt = s.transactionDate?.slice?.(0, 10) || s.transactionDate;
      if (!dt) return;
      const bankChannelAmount = (s.channels || [])
        .filter((ch) => {
          const v = ch.vault || ch.vaultId;
          const id = typeof v === 'object' ? v?.id : v;
          return bankSalesChannels.some((sc) => sc.id === id);
        })
        .reduce((sum, ch) => sum + Number(ch.amount || 0), 0);
      if (bankChannelAmount > 0) {
        map[dt] = (map[dt] || 0) + bankChannelAmount;
      }
    });
    return map;
  }, [salesData, bankSalesChannels]);

  const comparisonData = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      const dt = t.transactionDate?.slice?.(0, 10);
      if (!dt || t.amount <= 0) return;
      if (!map[dt]) map[dt] = { date: dt, statementDeposits: 0, recordedSales: 0 };
      map[dt].statementDeposits += t.amount;
    });
    Object.entries(salesByDate).forEach(([dt, amt]) => {
      if (!map[dt]) map[dt] = { date: dt, statementDeposits: 0, recordedSales: 0 };
      map[dt].recordedSales = amt;
    });
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-31);
  }, [transactions, salesByDate]);

  const resetFlow = useCallback(() => {
    setStep('setup');
    setFile(null);
    setRawGrid([]);
    setColCount(0);
    setColumnTypes({});
    setTransactions([]);
    setUploadError('');
    setAiError('');
  }, []);

  const months = useMemo(() => getMonthsForYear(parseInt(reportMonth?.slice(0, 4) || currentYear, 10)), [
    reportMonth,
    currentYear,
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t('bankStatementMonthlyTitle')}</h2>
        <p style={{ marginTop: 8, color: 'var(--noorix-text-muted)', fontSize: 14, lineHeight: 1.5 }}>
          {t('bankStatementMonthlyDesc')}
        </p>
      </header>

      {step === 'setup' && (
        <div
          className="noorix-surface-card"
          style={{
            padding: 28,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 24,
          }}
        >
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
              {t('bankStatementReportMonth')}
            </label>
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--noorix-border)',
                fontSize: 14,
              }}
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {lang === 'ar' ? m.labelAr : m.labelEn} {m.value.slice(0, 4)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
              {t('bankStatementSelectBank')}
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 160,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--noorix-border)',
                  fontSize: 14,
                }}
              >
                <option value="">{t('bankStatementNewBank')}</option>
                {templates.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.bankName}
                  </option>
                ))}
              </select>
              {templates.length > 0 && (
                <button
                  type="button"
                  className="noorix-btn-nav"
                  onClick={() => setShowTemplatesModal(true)}
                  style={{ padding: '10px 14px', fontSize: 13 }}
                >
                  {t('bankStatementManageTemplates')}
                </button>
              )}
            </div>
            {selectedTemplateId === '' && (
              <input
                type="text"
                value={bankNameForNew}
                onChange={(e) => setBankNameForNew(e.target.value)}
                placeholder={lang === 'ar' ? 'اسم البنك (مثل: الأهلي - الرئيسي)' : 'Bank name (e.g. Al Ahli - Main)'}
                style={{
                  marginTop: 10,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--noorix-border)',
                  fontSize: 14,
                }}
              />
            )}
          </div>
        </div>
      )}

      {step === 'setup' && (
        <div
          className="noorix-surface-card"
          style={{
            padding: 32,
            border: '2px dashed var(--noorix-border)',
            borderRadius: 14,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 200ms, background 200ms',
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--noorix-accent-blue)';
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--noorix-border)';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--noorix-border)';
            const f = e.dataTransfer?.files?.[0];
            if (f) handleFileSelect({ target: { files: [f] } });
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            {reportMonth} — {t('bankStatementUploadExcel')}
          </p>
          <p style={{ marginTop: 8, color: 'var(--noorix-text-muted)' }}>{t('bankStatementDragDrop')}</p>
          {uploadError && (
            <p style={{ marginTop: 12, color: 'var(--noorix-accent-red)', fontSize: 14 }}>{uploadError}</p>
          )}
        </div>
      )}

      {step === 'preview' && (
        <div className="noorix-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t('bankStatementFullGrid')}</h3>
          <p style={{ color: 'var(--noorix-text-muted)', fontSize: 13, marginBottom: 16 }}>
            {lang === 'ar'
              ? 'الخطوة 1: الذكاء يقترح البيانات ونطاق الجدول. الخطوة 2: راجع وأكد، ثم حدد نوع كل عمود إن لزم.'
              : 'Step 1: AI suggests metadata and table range. Step 2: Review and confirm, then set each column type if needed.'}
          </p>
          {aiMeta && (aiMeta.companyName || aiMeta.reportDate) && (
            <div
              style={{
                padding: 16,
                marginBottom: 16,
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 12,
              }}
            >
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('bankStatementAISuggestions')}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {aiMeta.companyName && (
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankStatementCompanyName')}: </span>
                    <strong>{aiMeta.companyName}</strong>
                  </div>
                )}
                {aiMeta.reportDate && (
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankStatementReportDateAI')}: </span>
                    <strong>{aiMeta.reportDate}</strong>
                  </div>
                )}
                <div>
                  <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankStatementTableRange')}: </span>
                  <strong>
                    {lang === 'ar' ? `صف ${dataStartRow + 1}` : `Row ${dataStartRow + 1}`} — {lang === 'ar' ? `صف ${dataEndRow + 1}` : `Row ${dataEndRow + 1}`}
                  </strong>
                </div>
                {aiMeta.headerRow != null && (
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankStatementHeaderRow')}: </span>
                    <strong>{lang === 'ar' ? `صف ${aiMeta.headerRow + 1}` : `Row ${aiMeta.headerRow + 1}`}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
              marginBottom: 16,
              alignItems: 'flex-end',
            }}
          >
            <div>
              <label
                style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}
              >
                {t('bankStatementDataStartRow')}
              </label>
              <select
                value={dataStartRow}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDataStartRow(v);
                  if (dataEndRow < v) setDataEndRow(v);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--noorix-border)',
                  minWidth: 100,
                }}
              >
                {rawGrid.map((_, i) => (
                  <option key={i} value={i}>
                    {lang === 'ar' ? `صف ${i + 1}` : `Row ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}
              >
                {t('bankStatementDataEndRow')}
              </label>
              <select
                value={dataEndRow}
                onChange={(e) => setDataEndRow(Number(e.target.value))}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--noorix-border)',
                  minWidth: 100,
                }}
              >
                {rawGrid.slice(dataStartRow).map((_, i) => (
                  <option key={i} value={dataStartRow + i}>
                    {lang === 'ar' ? `صف ${dataStartRow + i + 1}` : `Row ${dataStartRow + i + 1}`}
                  </option>
                ))}
              </select>
            </div>
            {geminiAvailable && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="noorix-btn-nav"
                  onClick={handleAISuggest}
                  disabled={aiLoading || !rawGrid?.length}
                  style={{
                    padding: '10px 18px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    color: '#fff',
                    fontWeight: 600,
                  }}
                >
                  {aiLoading ? t('bankStatementAIApplying') : t('bankStatementAISuggest')}
                </button>
                {aiLoading && (
                  <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                    {lang === 'ar' ? 'قد يستغرق حتى 45 ثانية...' : 'May take up to 45 seconds...'}
                  </span>
                )}
                {aiSuccess && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(22,163,74,0.12)',
                      border: '1px solid rgba(22,163,74,0.4)',
                      color: '#16a34a',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    ✓ {t('bankStatementAISuccess')}
                  </div>
                )}
                {aiError && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: 'rgba(220,38,38,0.1)',
                      border: '1px solid rgba(220,38,38,0.35)',
                      color: '#dc2626',
                      fontSize: 13,
                      maxWidth: 340,
                    }}
                  >
                    <strong>{lang === 'ar' ? 'فشل الاقتراح الذكي:' : 'Smart suggestion failed:'}</strong>
                    <br />
                    {aiError}
                  </div>
                )}
              </div>
            )}
            {!geminiAvailable && (
              <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankStatementAINoKey')}</div>
            )}
          </div>
          <div
            style={{
              overflowX: 'auto',
              border: '1px solid var(--noorix-border)',
              borderRadius: 8,
              maxHeight: 420,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--noorix-table-header-bg)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                  }}
                >
                  <th
                    style={{
                      padding: '8px 10px',
                      textAlign: 'center',
                      minWidth: 44,
                    }}
                  >
                    {t('bankStatementRowNum')}
                  </th>
                  {Array.from({ length: colCount }, (_, ci) => (
                    <th key={ci} style={{ padding: '6px 8px', textAlign: 'right', minWidth: 100 }}>
                      <select
                        value={columnTypes[ci] ?? 'ignore'}
                        onChange={(e) =>
                          setColumnTypes((prev) => ({ ...prev, [ci]: e.target.value }))
                        }
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--noorix-border)',
                          fontSize: 11,
                          width: '100%',
                        }}
                      >
                        {COL_TYPES.map((ct) => (
                          <option key={ct.key} value={ct.key}>
                            {t(ct.labelKey)}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawGrid.map((row, ri) => {
                  const inRange = ri >= dataStartRow && ri <= dataEndRow;
                  return (
                    <tr
                      key={ri}
                      style={{
                        borderTop: '1px solid var(--noorix-border)',
                        background: inRange ? 'rgba(37,99,235,0.04)' : 'transparent',
                      }}
                    >
                      <td
                        style={{
                          padding: '6px 10px',
                          textAlign: 'center',
                          fontWeight: 600,
                          color: 'var(--noorix-text-muted)',
                        }}
                      >
                        {ri + 1}
                      </td>
                      {Array.from({ length: colCount }, (_, ci) => (
                        <td
                          key={ci}
                          style={{
                            padding: '6px 10px',
                            maxWidth: 180,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {String(row[ci] ?? '').slice(0, 35)}
                          {String(row[ci] ?? '').length > 35 ? '...' : ''}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p
            style={{
              fontSize: 12,
              color: 'var(--noorix-text-muted)',
              marginTop: 8,
            }}
          >
            {rawGrid.length} {lang === 'ar' ? 'صف' : 'rows'} × {colCount}{' '}
            {lang === 'ar' ? 'عمود' : 'cols'}.
            {lang === 'ar' ? ' الصفوف المظللة = نطاق البيانات' : ' Highlighted rows = data range'}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              className="noorix-btn-nav"
              onClick={() => setStep('setup')}
              style={{ padding: '10px 18px' }}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              className="noorix-btn-nav"
              onClick={applyFromPreview}
              disabled={
                !Object.values(columnTypes).includes('date') ||
                (!Object.values(columnTypes).includes('debit') &&
                  !Object.values(columnTypes).includes('credit') &&
                  !Object.values(columnTypes).includes('amount'))
              }
              style={{ padding: '10px 18px', background: 'var(--noorix-accent-blue)', color: '#fff' }}
            >
              {t('bankStatementConfirmMapping')}
            </button>
          </div>
        </div>
      )}

      {step === 'analysis' && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="noorix-btn-nav"
              onClick={resetFlow}
              style={{ fontSize: 13 }}
            >
              {t('bankStatementUploadExcel')} ←
            </button>
            <button
              type="button"
              className="noorix-btn-nav"
              onClick={() => setStep('preview')}
              style={{ fontSize: 13 }}
            >
              {t('bankStatementFullGrid')} ←
            </button>
            <button
              type="button"
              className="noorix-btn-nav"
              onClick={() => setShowCategoryModal(true)}
            >
              {t('bankStatementManageCategories')}
            </button>
            {transactions.length > 0 && (
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--noorix-accent-green)',
                  fontWeight: 600,
                }}
              >
                {t('bankStatementParsedCount', transactions.length)}
              </span>
            )}
          </div>

          {!selectedTemplate && (
            <div
              className="noorix-surface-card"
              style={{
                padding: 20,
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 12,
              }}
            >
              <h4 style={{ marginBottom: 12, fontSize: 14 }}>{t('bankStatementSaveTemplate')}</h4>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  placeholder={lang === 'ar' ? 'اسم البنك (مثل: الأهلي - الرئيسي)' : 'Bank name (e.g. Al Ahli - Main)'}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--noorix-border)',
                    flex: 1,
                    minWidth: 200,
                  }}
                />
                <button
                  type="button"
                  className="noorix-btn-nav"
                  onClick={handleSaveTemplate}
                  disabled={
                    !(saveTemplateName || '').trim() || createTemplateMutation.isPending
                  }
                  style={{
                    padding: '10px 18px',
                    background: 'var(--noorix-accent-blue)',
                    color: '#fff',
                  }}
                >
                  {createTemplateMutation.isPending
                    ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                    : t('bankStatementSaveTemplate')}
                </button>
                {saveTemplateSuccess && (
                  <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                    ✓ {t('bankStatementTemplateSaved')}
                  </span>
                )}
              </div>
              <p style={{ marginTop: 10, fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                {lang === 'ar'
                  ? 'سيُطبَّق القالب تلقائياً عند رفع كشف الشهر القادم من نفس البنك.'
                  : 'Template will be auto-applied when uploading next month\'s statement from the same bank.'}
              </p>
            </div>
          )}

          {transactions.length === 0 && (
            <div
              className="noorix-surface-card"
              style={{
                padding: 24,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 12,
              }}
            >
              <p style={{ fontSize: 15, fontWeight: 600, color: '#dc2626', margin: 0 }}>
                {t('bankStatementParseWarning')}
              </p>
              <p style={{ marginTop: 8, color: 'var(--noorix-text-muted)' }}>
                {lang === 'ar'
                  ? 'غيّر صف العناوين أو ربط الأعمدة ثم أعد المحاولة.'
                  : 'Change header row or column mapping and try again.'}
              </p>
            </div>
          )}

          {showCategoryModal && (
            <div className="noorix-surface-card" style={{ padding: 24 }}>
              <h3 style={{ marginBottom: 16 }}>{t('bankStatementCategories')}</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t('bankStatementCategoryName')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--noorix-border)',
                    flex: 1,
                  }}
                />
                <button type="button" className="noorix-btn-nav" onClick={addCategory}>
                  {t('bankStatementAddCategory')}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {categories.map((c) => (
                  <span
                    key={c.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: `${c.color}22`,
                      border: `1px solid ${c.color}`,
                    }}
                  >
                    <span>{categoryName(c, lang)}</span>
                    <button
                      type="button"
                      onClick={() => removeCategory(c.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 14,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="noorix-btn-nav"
                style={{ marginTop: 16 }}
                onClick={() => setShowCategoryModal(false)}
              >
                {t('close')}
              </button>
            </div>
          )}

          {showTemplatesModal && (
            <TemplatesModal
              templates={templates}
              onClose={() => setShowTemplatesModal(false)}
              onDelete={(id) => {
                deleteBankStatementTemplate(id, activeCompanyId).then(() => {
                  queryClient.invalidateQueries({ queryKey: ['bank-statement-templates', activeCompanyId] });
                });
              }}
              t={t}
              lang={lang}
            />
          )}

          {transactions.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              <div className="noorix-surface-card" style={{ padding: 20, minHeight: 280 }}>
                <h4 style={{ marginBottom: 16 }}>{t('bankStatementByCategory')}</h4>
                {byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={byCategory}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                      >
                        {byCategory.map((e, i) => (
                          <Cell key={i} fill={e.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v, 2) + ' ﷼'} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ color: 'var(--noorix-text-muted)' }}>{t('uncategorized')}</p>
                )}
              </div>
              {comparisonData.length > 0 && bankSalesChannels.length > 0 && (
                <div className="noorix-surface-card" style={{ padding: 20, minHeight: 280 }}>
                  <h4 style={{ marginBottom: 16 }}>{t('bankStatementCompareWithSales')}</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v, 0)} />
                      <Tooltip formatter={(v) => fmt(v, 2) + ' ﷼'} />
                      <Legend />
                      <Bar
                        dataKey="statementDeposits"
                        name={t('bankStatementBankCredits')}
                        fill="#2563eb"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="recordedSales"
                        name={t('bankStatementSalesRecorded')}
                        fill="#16a34a"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {transactions.length > 0 && (
            <div
              className="noorix-surface-card"
              style={{ padding: 0, overflow: 'auto', maxHeight: 400 }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--noorix-table-header-bg)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('bankStatementDate')}</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('bankStatementDescription')}</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('bankStatementAmount')}</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>{t('bankStatementCategories')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 200).map((tr) => (
                    <tr key={tr.id} style={{ borderTop: '1px solid var(--noorix-border)' }}>
                      <td style={{ padding: '8px 12px' }}>{tr.transactionDate}</td>
                      <td
                        style={{
                          padding: '8px 12px',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {tr.description || '—'}
                      </td>
                      <td
                        style={{
                          padding: '8px 12px',
                          fontFamily: 'var(--noorix-font-numbers)',
                          color: tr.amount >= 0 ? '#16a34a' : '#dc2626',
                        }}
                      >
                        {fmt(tr.amount, 2)} ﷼
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <select
                          value={tr.categoryId ?? ''}
                          onChange={(e) => updateTransactionCategory(tr.id, e.target.value || null)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--noorix-border)',
                            fontSize: 13,
                          }}
                        >
                          <option value="">{t('uncategorized')}</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {categoryName(c, lang)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {transactions.length > 200 && (
            <p style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>
              {lang === 'ar' ? `عرض أول 200 حركة من أصل ${transactions.length}` : `Showing first 200 of ${transactions.length} transactions`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TemplatesModal({ templates, onClose, onDelete, t, lang }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        className="noorix-surface-card"
        style={{ padding: 24, maxWidth: 420, width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: 16 }}>{t('bankStatementManageTemplates')}</h3>
        {templates.length === 0 ? (
          <p style={{ color: 'var(--noorix-text-muted)' }}>
            {lang === 'ar' ? 'لا توجد قوالب محفوظة' : 'No saved templates'}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {templates.map((tp) => (
              <li
                key={tp.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderTop: '1px solid var(--noorix-border)',
                }}
              >
                <span>{tp.bankName}</span>
                <button
                  type="button"
                  className="noorix-btn-nav"
                  onClick={() => onDelete(tp.id)}
                  style={{ padding: '6px 12px', fontSize: 12, color: '#dc2626' }}
                >
                  {t('bankStatementDeleteTemplate')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="noorix-btn-nav" style={{ marginTop: 16 }} onClick={onClose}>
          {t('close')}
        </button>
      </div>
    </div>
  );
}

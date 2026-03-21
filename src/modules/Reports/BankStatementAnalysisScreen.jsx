/**
 * BankStatementAnalysisScreen — تحليل كشف الحسابات
 * رفع Excel، ربط الأعمدة، تصنيف الحركات، رسوم بيانية، مقارنة مع مبيعات قنوات البنك
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useVaults } from '../../hooks/useVaults';
import { importFromExcel } from '../../utils/exportUtils';
import { parseDate, parseNumber } from '../../utils/importTemplates';
import { fetchAllSalesSummariesForExport } from '../../services/api';
import { fmt } from '../../utils/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const STORAGE_CATEGORIES = 'noorix_bank_statement_categories';
const STORAGE_PREFIX = 'noorix_bank_';

const SYSTEM_FIELDS = [
  { key: 'transactionDate', labelKey: 'bankStatementDate', required: true },
  { key: 'amount', labelKey: 'bankStatementAmount', required: true },
  { key: 'description', labelKey: 'bankStatementDescription', required: false },
  { key: 'balance', labelKey: 'bankStatementBalance', required: false },
  { key: 'transactionType', labelKey: 'bankStatementType', required: false },
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

export default function BankStatementAnalysisScreen() {
  const { activeCompanyId } = useApp();
  const { t, lang } = useTranslation();
  const { salesChannels } = useVaults({ companyId: activeCompanyId });

  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(loadCategories);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [uploadError, setUploadError] = useState('');

  const fileInputRef = React.useRef(null);

  const handleFileSelect = useCallback(async (e) => {
    const f = e?.target?.files?.[0];
    if (!f) return;
    setUploadError('');
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      setUploadError(lang === 'ar' ? 'يرجى رفع ملف Excel (.xlsx أو .xls)' : 'Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    try {
      const rows = await importFromExcel(f);
      if (!rows?.length) {
        setUploadError(lang === 'ar' ? 'الملف فارغ أو بدون صفوف' : 'File is empty or has no rows');
        return;
      }
      const hdrs = Object.keys(rows[0] || {});
      setFile(f);
      setRawRows(rows);
      setHeaders(hdrs);
      setColumnMapping({});
      setStep('mapping');
    } catch (err) {
      setUploadError(err?.message || (lang === 'ar' ? 'فشل قراءة الملف' : 'Failed to read file'));
    }
  }, [lang]);

  const applyMapping = useCallback(() => {
    const dateKey = columnMapping.transactionDate;
    const amountKey = columnMapping.amount;
    const descKey = columnMapping.description;
    const balanceKey = columnMapping.balance;
    const typeKey = columnMapping.transactionType;

    if (!dateKey || !amountKey) {
      return;
    }

    const mapped = rawRows
      .map((row, idx) => {
        const dateVal = row[dateKey];
        const amountVal = row[amountKey];
        const desc = descKey ? String(row[descKey] ?? '').trim() : '';
        const balanceVal = balanceKey != null ? row[balanceKey] : null;
        const typeVal = typeKey ? row[typeKey] : null;

        const date = parseDate(dateVal);
        let amount = parseNumber(amountVal);

        if (amount == null && (typeVal != null || desc)) {
          const n = parseNumber(amountVal);
          if (n != null) amount = n;
        }

        if (typeVal != null && amount != null) {
          const s = String(typeVal).toLowerCase();
          if (s.includes('مدين') || s.includes('debit') || s.includes('سحب')) {
            amount = -Math.abs(amount);
          } else if (s.includes('دائن') || s.includes('credit') || s.includes('إيداع')) {
            amount = Math.abs(amount);
          }
        }

        if (date && amount != null) {
          return {
            id: `row-${idx}`,
            transactionDate: date,
            amount: Number(amount),
            description: desc,
            balance: balanceVal != null ? parseNumber(balanceVal) : null,
            categoryId: null,
          };
        }
        return null;
      })
      .filter(Boolean);

    setTransactions(mapped);
    setStep('analysis');
  }, [rawRows, columnMapping]);

  const updateTransactionCategory = useCallback((id, categoryId) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, categoryId } : t)));
  }, []);

  const addCategory = useCallback(() => {
    const name = (newCategoryName || '').trim();
    if (!name) return;
    const id = `cat-${Date.now()}`;
    const color = ['#6366f1', '#22c55e', '#f97316', '#0ea5e9', '#e11d48', '#8b5cf6'][categories.length % 6];
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

  const categoryName = (cat, lng) => (lng === 'en' ? cat?.nameEn || cat?.nameAr : cat?.nameAr || cat?.nameEn) || '—';

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
      name: x.categoryId === '__uncategorized' ? t('uncategorized') : categoryName(categories.find((c) => c.id === x.categoryId), lang),
      fill: x.categoryId === '__uncategorized' ? '#94a3b8' : categories.find((c) => c.id === x.categoryId)?.color || '#94a3b8',
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
      const items = await fetchAllSalesSummariesForExport(activeCompanyId, dateRange.start, dateRange.end);
      return Array.isArray(items) ? items : [];
    },
    enabled: !!activeCompanyId && !!dateRange && dateRange.start && dateRange.end,
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
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).slice(-31);
  }, [transactions, salesByDate]);

  const resetFlow = useCallback(() => {
    setStep('upload');
    setFile(null);
    setRawRows([]);
    setHeaders([]);
    setColumnMapping({});
    setTransactions([]);
    setUploadError('');
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{t('reportBankStatementAnalysis')}</h2>
        <p style={{ marginTop: 6, color: 'var(--noorix-text-muted)' }}>{t('bankUploadDesc')}</p>
      </div>

      {step === 'upload' && (
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
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--noorix-accent-blue)'; }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--noorix-border)'; }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--noorix-border)';
            const f = e.dataTransfer?.files?.[0];
            if (f) handleFileSelect({ target: { files: [f] } });
          }}
        >
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} style={{ display: 'none' }} />
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t('bankStatementUploadExcel')}</p>
          <p style={{ marginTop: 8, color: 'var(--noorix-text-muted)' }}>{t('bankStatementDragDrop')}</p>
          {uploadError && <p style={{ marginTop: 12, color: 'var(--noorix-accent-red)' }}>{uploadError}</p>}
        </div>
      )}

      {step === 'mapping' && (
        <div className="noorix-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('bankStatementColumnMapping')}</h3>
          <p style={{ color: 'var(--noorix-text-muted)', fontSize: 13, marginBottom: 20 }}>
            {t('bankStatementMapFileColumn')} → {t('bankStatementMapSystemColumn')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SYSTEM_FIELDS.map((sf) => (
              <div key={sf.key} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ minWidth: 140, fontWeight: 600 }}>{t(sf.labelKey)}{sf.required ? ' *' : ''}</label>
                <select
                  value={columnMapping[sf.key] ?? ''}
                  onChange={(e) => setColumnMapping((m) => ({ ...m, [sf.key]: e.target.value || null }))}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', minWidth: 200 }}
                >
                  <option value="">{t('bankStatementSkipColumn')}</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <button type="button" className="noorix-btn-nav" onClick={() => setStep('upload')} style={{ padding: '10px 18px' }}>
              {t('cancel')}
            </button>
            <button
              type="button"
              className="noorix-btn-nav"
              onClick={applyMapping}
              disabled={!columnMapping.transactionDate || !columnMapping.amount}
              style={{ padding: '10px 18px', background: 'var(--noorix-accent-blue)', color: '#fff' }}
            >
              {t('bankStatementConfirmMapping')}
            </button>
          </div>
        </div>
      )}

      {step === 'analysis' && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="noorix-btn-nav" onClick={resetFlow} style={{ fontSize: 13 }}>
              {t('bankStatementUploadExcel')} ←
            </button>
            <button type="button" className="noorix-btn-nav" onClick={() => setShowCategoryModal(true)}>
              {t('bankStatementManageCategories')}
            </button>
          </div>

          {showCategoryModal && (
            <div className="noorix-surface-card" style={{ padding: 24 }}>
              <h3 style={{ marginBottom: 16 }}>{t('bankStatementCategories')}</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t('bankStatementCategoryName')}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', flex: 1 }}
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
                    <button type="button" onClick={() => removeCategory(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </span>
                ))}
              </div>
              <button type="button" className="noorix-btn-nav" style={{ marginTop: 16 }} onClick={() => setShowCategoryModal(false)}>
                {t('close')}
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div className="noorix-surface-card" style={{ padding: 20, minHeight: 280 }}>
              <h4 style={{ marginBottom: 16 }}>{t('bankStatementByCategory')}</h4>
              {byCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byCategory} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
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
                    <Bar dataKey="statementDeposits" name={t('bankStatementBankCredits')} fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="recordedSales" name={t('bankStatementSalesRecorded')} fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="noorix-surface-card" style={{ padding: 0, overflow: 'auto', maxHeight: 400 }}>
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
                {transactions.slice(0, 200).map((t) => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--noorix-border)' }}>
                    <td style={{ padding: '8px 12px' }}>{t.transactionDate}</td>
                    <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description || '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--noorix-font-numbers)', color: t.amount >= 0 ? '#16a34a' : '#dc2626' }}>
                      {fmt(t.amount, 2)} ﷼
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <select
                        value={t.categoryId ?? ''}
                        onChange={(e) => updateTransactionCategory(t.id, e.target.value || null)}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--noorix-border)', fontSize: 13 }}
                      >
                        <option value="">{t('uncategorized')}</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{categoryName(c, lang)}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {transactions.length > 200 && <p style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>عرض أول 200 حركة من أصل {transactions.length}</p>}
        </>
      )}
    </div>
  );
}

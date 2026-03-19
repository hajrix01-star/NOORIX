/**
 * TaxReportTab — تقرير الضرائب مطابق لنموذج الإفصاح الضريبي السعودي (مصلحة الزكاة والضريبة والجمارك)
 * نموذج إقرار ضريبة القيمة المضافة — قابل للتعديل — يستورد من النظام المحاسبي
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useTaxReport } from '../../hooks/useReports';
import { exportToExcel } from '../../utils/exportUtils';
import { fmt } from '../../utils/format';

const STORAGE_KEY = 'noorix_tax_report_v1';

// بنود نموذج الإفصاح الضريبي — مخرجات ضريبة القيمة المضافة
const OUTPUT_ROWS = [
  { key: 'standard_sales', labelAr: 'مبيعات بالمعدل القياسي 15%', labelEn: 'Standard-rated sales 15%' },
  { key: 'special_sales', labelAr: 'مبيعات خاصة (صحة/تعليم/أول منزل للمواطنين)', labelEn: 'Private healthcare/education/first house' },
  { key: 'zero_rated_domestic', labelAr: 'مبيعات صفرية محلية', labelEn: 'Zero-rated domestic sales' },
  { key: 'exports', labelAr: 'الصادرات', labelEn: 'Exports' },
  { key: 'exempt_sales', labelAr: 'مبيعات معفاة', labelEn: 'Exempt sales' },
  { key: 'output_total', labelAr: 'إجمالي مخرجات ضريبة القيمة المضافة', labelEn: 'Total output VAT', isTotal: true },
];

// بنود مدخلات ضريبة القيمة المضافة
const INPUT_ROWS = [
  { key: 'standard_purchases', labelAr: 'مشتريات محلية بالمعدل القياسي', labelEn: 'Standard-rated local purchases' },
  { key: 'imports_customs', labelAr: 'واردات خاضعة (مدفوعة عند الجمارك)', labelEn: 'Imports at customs' },
  { key: 'reverse_charge', labelAr: 'واردات خاضعة للتكليف العكسي', labelEn: 'Reverse charge imports' },
  { key: 'exempt_purchases', labelAr: 'مشتريات معفاة', labelEn: 'Exempt purchases' },
  { key: 'input_total', labelAr: 'إجمالي مدخلات ضريبة القيمة المضافة', labelEn: 'Total input VAT', isTotal: true },
];

// بنود الملخص
const SUMMARY_ROWS = [
  { key: 'vat_due', labelAr: 'إجمالي ضريبة القيمة المضافة المستحقة', labelEn: 'Total VAT due' },
  { key: 'vat_recoverable', labelAr: 'إجمالي ضريبة القيمة المضافة المستردة', labelEn: 'Total VAT recoverable' },
  { key: 'net_vat', labelAr: 'صافي ضريبة القيمة المضافة', labelEn: 'Net VAT' },
  { key: 'prior_adjustments', labelAr: 'تصحيحات من الفترة السابقة', labelEn: 'Prior period adjustments' },
  { key: 'balance_carried', labelAr: 'رصيد مرحلة', labelEn: 'Balance carried forward' },
  { key: 'net_payable_refund', labelAr: 'صافي الضريبة المستحقة أو المطالب بها', labelEn: 'Net VAT payable or refundable', isFinal: true },
];

const defaultData = () => {
  const rows = [...OUTPUT_ROWS, ...INPUT_ROWS].filter((r) => !r.isTotal);
  const obj = {};
  rows.forEach((r) => { obj[r.key] = { amount: 0, adjustment: 0, vat: 0 }; });
  SUMMARY_ROWS.forEach((r) => { obj[r.key] = 0; });
  return obj;
};

function loadStoredData(companyId, period) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${companyId}_${period}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultData(), ...parsed };
    }
  } catch (_) {}
  return defaultData();
}

function saveStoredData(companyId, period, data) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${companyId}_${period}`, JSON.stringify(data));
  } catch (_) {}
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function mergeImportedData(stored, imported) {
  if (!imported || typeof imported !== 'object') return stored;
  const next = { ...stored };
  const rowKeys = [...OUTPUT_ROWS, ...INPUT_ROWS].filter((r) => !r.isTotal).map((r) => r.key);
  for (const key of rowKeys) {
    if (imported[key] && typeof imported[key] === 'object') {
      next[key] = { ...(next[key] || { amount: 0, adjustment: 0, vat: 0 }), ...imported[key] };
    }
  }
  return next;
}

export default function TaxReportTab() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState('Q1'); // Q1, Q2, Q3, Q4, M1..M12
  const periodKey = `${year}-${period}`;
  const [data, setData] = useState(() => loadStoredData(activeCompanyId || '', periodKey));

  const { data: importedData, isLoading: importLoading, refetch: refetchTax } = useTaxReport({
    companyId: activeCompanyId,
    year,
    period,
    enabled: !!activeCompanyId,
  });

  const company = companies?.find((c) => c.id === activeCompanyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');
  const periodOptions = useMemo(() => {
    const opts = [];
    for (let q = 1; q <= 4; q++) opts.push({ value: `Q${q}`, label: lang === 'ar' ? `الربع ${q}` : `Q${q}` });
    for (let m = 1; m <= 12; m++) opts.push({ value: `M${m}`, label: EN_MONTHS[m - 1] });
    return opts;
  }, [lang]);

  useEffect(() => {
    setData((prev) => {
      const stored = loadStoredData(activeCompanyId || '', periodKey);
      return mergeImportedData(stored, importedData);
    });
  }, [activeCompanyId, periodKey, importedData]);

  const handleImportFromSystem = () => {
    refetchTax().then((result) => {
      const imported = result?.data;
      if (imported) {
        const stored = loadStoredData(activeCompanyId || '', periodKey);
        const merged = mergeImportedData(stored, imported);
        setData(merged);
        saveStoredData(activeCompanyId || '', periodKey, merged);
      }
    });
  };

  const handlePrint = () => {
    const label = (r) => (lang === 'ar' ? r.labelAr : r.labelEn);
    const outRows = OUTPUT_ROWS.map((r) => {
      const amt = r.isTotal ? outputTotal : getRowValue(r.key, 'amount');
      const vat = r.isTotal ? outputTotal : getRowValue(r.key, 'vat');
      return `<tr><td>${(label(r) || '').replace(/</g, '&lt;')}</td><td>${fmt(amt, 2)}</td><td>${r.isTotal ? '—' : fmt(getRowValue(r.key, 'adjustment'), 2)}</td><td>${fmt(vat, 2)}</td></tr>`;
    }).join('');
    const inRows = INPUT_ROWS.map((r) => {
      const amt = r.isTotal ? inputTotal : getRowValue(r.key, 'amount');
      const vat = r.isTotal ? inputTotal : getRowValue(r.key, 'vat');
      return `<tr><td>${(label(r) || '').replace(/</g, '&lt;')}</td><td>${fmt(amt, 2)}</td><td>${r.isTotal ? '—' : fmt(getRowValue(r.key, 'adjustment'), 2)}</td><td>${fmt(vat, 2)}</td></tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${(lang === 'ar' ? 'تقرير الضرائب' : 'Tax Report').replace(/</g, '&lt;')}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:'Cairo',Arial,sans-serif;margin:0;padding:24px;font-size:14px;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 12px;border:1px solid #ddd}th{background:#2563eb;color:#fff;font-weight:700}@media print{body{padding:0}}</style></head><body>
<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px">
<h1 style="margin:0;font-size:20px">${(companyName || '').replace(/</g, '&lt;')}</h1>
<p style="margin:8px 0 0;font-size:12px;color:#555">${(lang === 'ar' ? 'نموذج الإفصاح الضريبي — ضريبة القيمة المضافة' : 'VAT Tax Disclosure Form').replace(/</g, '&lt;')} — ${periodKey}</p>
</div>
<table><thead><tr><th>${(t('reportItem') || '').replace(/</g, '&lt;')}</th><th>${(lang === 'ar' ? 'المبلغ (ر.س)' : 'Amount (SAR)').replace(/</g, '&lt;')}</th><th>${(lang === 'ar' ? 'التعديلات' : 'Adjustments').replace(/</g, '&lt;')}</th><th>${(lang === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT').replace(/</g, '&lt;')}</th></tr></thead>
<tbody><tr><td colspan="4" style="background:rgba(22,163,74,0.15);font-weight:700">${(lang === 'ar' ? 'مخرجات ضريبة القيمة المضافة (المبيعات)' : 'Output VAT (Sales)').replace(/</g, '&lt;')}</td></tr>${outRows}
<tr><td colspan="4" style="background:rgba(220,38,38,0.15);font-weight:700">${(lang === 'ar' ? 'مدخلات ضريبة القيمة المضافة (المشتريات)' : 'Input VAT (Purchases)').replace(/</g, '&lt;')}</td></tr>${inRows}
<tr><td colspan="4" style="background:rgba(37,99,235,0.15);font-weight:700">${(lang === 'ar' ? 'الملخص' : 'Summary').replace(/</g, '&lt;')}</td></tr>
<tr><td>${(lang === 'ar' ? 'إجمالي الضريبة المستحقة' : 'Total VAT due').replace(/</g, '&lt;')}</td><td colspan="3">${fmt(outputTotal, 2)} ر.س</td></tr>
<tr><td>${(lang === 'ar' ? 'إجمالي الضريبة المستردة' : 'Total VAT recoverable').replace(/</g, '&lt;')}</td><td colspan="3">${fmt(inputTotal, 2)} ر.س</td></tr>
<tr><td>${(lang === 'ar' ? 'صافي الضريبة' : 'Net VAT').replace(/</g, '&lt;')}</td><td colspan="3">${fmt(netVat, 2)} ر.س</td></tr>
<tr><td>${(lang === 'ar' ? 'تصحيحات من الفترة السابقة' : 'Prior period adjustments').replace(/</g, '&lt;')}</td><td colspan="3">${fmt(priorAdj, 2)}</td></tr>
<tr><td>${(lang === 'ar' ? 'رصيد مرحلة' : 'Balance carried forward').replace(/</g, '&lt;')}</td><td colspan="3">${fmt(balanceCarried, 2)}</td></tr>
<tr style="background:rgba(37,99,235,0.2);font-weight:800"><td>${(lang === 'ar' ? 'صافي الضريبة المستحقة أو المطالب بها' : 'Net VAT payable or refundable').replace(/</g, '&lt;')}</td><td colspan="3">${fmt(netPayable, 2)} ر.س</td></tr>
</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onafterprint = () => { try { w.close(); } catch (_) {} };
      w.onload = () => setTimeout(() => w.print(), 300);
    }
  };

  const updateRow = (key, field, value) => {
    const num = parseFloat(String(value).replace(/,/g, '')) || 0;
    setData((prev) => {
      const next = { ...prev };
      const isSummaryField = !field || SUMMARY_ROWS.some((r) => r.key === key);
      if (isSummaryField) {
        next[key] = num;
      } else {
        next[key] = { ...(next[key] || { amount: 0, adjustment: 0, vat: 0 }), [field]: num };
      }
      saveStoredData(activeCompanyId || '', periodKey, next);
      return next;
    });
  };

  const getRowValue = (key, field) => {
    const v = data[key];
    if (v && typeof v === 'object') return v[field] ?? 0;
    return typeof v === 'number' ? v : 0;
  };

  const outputTotal = useMemo(() => {
    let sum = 0;
    OUTPUT_ROWS.filter((r) => !r.isTotal).forEach((r) => { sum += getRowValue(r.key, 'vat'); });
    return sum;
  }, [data]);

  const inputTotal = useMemo(() => {
    let sum = 0;
    INPUT_ROWS.filter((r) => !r.isTotal).forEach((r) => { sum += getRowValue(r.key, 'vat'); });
    return sum;
  }, [data]);

  const netVat = outputTotal - inputTotal;
  const priorAdj = getRowValue('prior_adjustments');
  const balanceCarried = getRowValue('balance_carried');
  const netPayable = netVat + priorAdj + balanceCarried;

  const inputStyle = {
    width: '100%',
    maxWidth: 120,
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--noorix-border)',
    background: 'var(--noorix-bg-surface)',
    fontSize: 14,
    fontFamily: 'var(--noorix-font-numbers)',
    textAlign: 'right',
  };

  const renderEditableCell = (key, field) => (
    <input
      type="text"
      inputMode="decimal"
      value={getRowValue(key, field) || ''}
      onChange={(e) => updateRow(key, field, e.target.value)}
      placeholder="0"
      style={inputStyle}
    />
  );

  const exportData = useMemo(() => {
    const rows = [];
    const label = (r) => (lang === 'ar' ? r.labelAr : r.labelEn);
    OUTPUT_ROWS.forEach((r) => {
      if (r.isTotal) rows.push({ [t('reportItem')]: label(r), [lang === 'ar' ? 'المبلغ' : 'Amount']: outputTotal, [lang === 'ar' ? 'الضريبة' : 'VAT']: outputTotal });
      else rows.push({ [t('reportItem')]: label(r), [lang === 'ar' ? 'المبلغ' : 'Amount']: getRowValue(r.key, 'amount'), [lang === 'ar' ? 'الضريبة' : 'VAT']: getRowValue(r.key, 'vat') });
    });
    INPUT_ROWS.forEach((r) => {
      if (r.isTotal) rows.push({ [t('reportItem')]: label(r), [lang === 'ar' ? 'المبلغ' : 'Amount']: inputTotal, [lang === 'ar' ? 'الضريبة' : 'VAT']: inputTotal });
      else rows.push({ [t('reportItem')]: label(r), [lang === 'ar' ? 'المبلغ' : 'Amount']: getRowValue(r.key, 'amount'), [lang === 'ar' ? 'الضريبة' : 'VAT']: getRowValue(r.key, 'vat') });
    });
    rows.push({ [t('reportItem')]: label(SUMMARY_ROWS.find((r) => r.key === 'net_payable_refund')), [lang === 'ar' ? 'المبلغ' : 'Amount']: netPayable });
    return rows;
  }, [data, outputTotal, inputTotal, netPayable, lang, t]);

  const handleExportExcel = () => {
    exportToExcel(exportData, `tax-disclosure-${periodKey}.xlsx`);
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{lang === 'ar' ? 'تقرير الضرائب — نموذج الإفصاح الضريبي' : 'Tax Report — ZATCA Disclosure Form'}</h2>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
            {lang === 'ar' ? 'مطابق لنموذج مصلحة الزكاة والضريبة والجمارك. جميع الحقول قابلة للتعديل.' : 'Matches ZATCA tax disclosure form. All fields are editable.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('reportYear')}</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)' }}>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <label style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{lang === 'ar' ? 'الفترة' : 'Period'}</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)' }}>
            {periodOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button type="button" className="noorix-btn-nav" onClick={handleImportFromSystem} disabled={!activeCompanyId || importLoading}>
            {importLoading ? t('loading') : (lang === 'ar' ? 'استيراد من النظام' : 'Import from system')}
          </button>
          <button type="button" className="noorix-btn-nav" onClick={handlePrint}>{t('print')}</button>
          <button type="button" className="noorix-btn-nav" onClick={handleExportExcel}>{t('exportExcel')}</button>
        </div>
      </div>

      {!activeCompanyId ? (
        <div className="noorix-surface-card" style={{ padding: 20, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
          {t('pleaseSelectCompany')}
        </div>
      ) : (
        <div className="noorix-surface-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--noorix-border)', background: 'rgba(37,99,235,0.04)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--noorix-accent-blue)' }}>{companyName}</div>
            <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 4 }}>
              {lang === 'ar' ? 'نموذج الإفصاح الضريبي — ضريبة القيمة المضافة' : 'VAT Tax Disclosure Form'} — {periodKey}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)', background: 'var(--noorix-table-header-bg)', fontWeight: 700, width: 280 }}>
                    {t('reportItem')}
                  </th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)', background: 'var(--noorix-table-header-bg)', fontWeight: 700 }}>
                    {lang === 'ar' ? 'المبلغ (ر.س)' : 'Amount (SAR)'}
                  </th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)', background: 'var(--noorix-table-header-bg)', fontWeight: 700 }}>
                    {lang === 'ar' ? 'التعديلات (ر.س)' : 'Adjustments (SAR)'}
                  </th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)', background: 'var(--noorix-table-header-bg)', fontWeight: 700 }}>
                    {lang === 'ar' ? 'ضريبة القيمة المضافة (ر.س)' : 'VAT (SAR)'}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} style={{ padding: '10px 12px', background: 'rgba(22,163,74,0.06)', fontWeight: 700, color: '#16a34a' }}>
                    {lang === 'ar' ? 'مخرجات ضريبة القيمة المضافة (المبيعات)' : 'Output VAT (Sales)'}
                  </td>
                </tr>
                {OUTPUT_ROWS.map((r) => (
                  <tr key={r.key} style={{ background: r.isTotal ? 'rgba(15,23,42,0.04)' : undefined }}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)', fontWeight: r.isTotal ? 700 : 500 }}>
                      {lang === 'ar' ? r.labelAr : r.labelEn}
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'center' }}>
                      {r.isTotal ? fmt(outputTotal, 2) : renderEditableCell(r.key, 'amount')}
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'center' }}>
                      {r.isTotal ? '—' : renderEditableCell(r.key, 'adjustment')}
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'center', fontFamily: 'var(--noorix-font-numbers)' }}>
                      {r.isTotal ? fmt(outputTotal, 2) : renderEditableCell(r.key, 'vat')}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} style={{ padding: '10px 12px', background: 'rgba(220,38,38,0.06)', fontWeight: 700, color: '#dc2626' }}>
                    {lang === 'ar' ? 'مدخلات ضريبة القيمة المضافة (المشتريات)' : 'Input VAT (Purchases)'}
                  </td>
                </tr>
                {INPUT_ROWS.map((r) => (
                  <tr key={r.key} style={{ background: r.isTotal ? 'rgba(15,23,42,0.04)' : undefined }}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)', fontWeight: r.isTotal ? 700 : 500 }}>
                      {lang === 'ar' ? r.labelAr : r.labelEn}
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'center' }}>
                      {r.isTotal ? fmt(inputTotal, 2) : renderEditableCell(r.key, 'amount')}
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'center' }}>
                      {r.isTotal ? '—' : renderEditableCell(r.key, 'adjustment')}
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'center', fontFamily: 'var(--noorix-font-numbers)' }}>
                      {r.isTotal ? fmt(inputTotal, 2) : renderEditableCell(r.key, 'vat')}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} style={{ padding: '10px 12px', background: 'rgba(37,99,235,0.06)', fontWeight: 700, color: '#2563eb' }}>
                    {lang === 'ar' ? 'الملخص' : 'Summary'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)' }}>{lang === 'ar' ? 'إجمالي الضريبة المستحقة' : 'Total VAT due'}</td>
                  <td colSpan={3} style={{ padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'right', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(outputTotal, 2)} ر.س</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)' }}>{lang === 'ar' ? 'إجمالي الضريبة المستردة' : 'Total VAT recoverable'}</td>
                  <td colSpan={3} style={{ padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'right', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(inputTotal, 2)} ر.س</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)' }}>{lang === 'ar' ? 'صافي الضريبة' : 'Net VAT'}</td>
                  <td colSpan={3} style={{ padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'right', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 700 }}>{fmt(netVat, 2)} ر.س</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)' }}>{lang === 'ar' ? 'تصحيحات من الفترة السابقة' : 'Prior period adjustments'}</td>
                  <td colSpan={3} style={{ padding: '8px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'center' }}>
                    <input type="text" inputMode="decimal" value={priorAdj || ''} onChange={(e) => updateRow('prior_adjustments', null, e.target.value)} placeholder="0" style={{ ...inputStyle, margin: 0 }} />
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--noorix-border)' }}>{lang === 'ar' ? 'رصيد مرحلة' : 'Balance carried forward'}</td>
                  <td colSpan={3} style={{ padding: '8px 12px', borderBottom: '1px solid var(--noorix-border)', textAlign: 'center' }}>
                    <input type="text" inputMode="decimal" value={balanceCarried || ''} onChange={(e) => updateRow('balance_carried', null, e.target.value)} placeholder="0" style={{ ...inputStyle, margin: 0 }} />
                  </td>
                </tr>
                <tr style={{ background: 'rgba(37,99,235,0.08)', borderTop: '2px solid var(--noorix-accent-blue)' }}>
                  <td style={{ padding: '12px 12px', fontWeight: 800 }}>{lang === 'ar' ? 'صافي الضريبة المستحقة أو المطالب بها' : 'Net VAT payable or refundable'}</td>
                  <td colSpan={3} style={{ padding: '12px 12px', textAlign: 'right', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 800, color: netPayable >= 0 ? '#dc2626' : '#16a34a' }}>
                    {fmt(netPayable, 2)} ر.س {netPayable >= 0 ? (lang === 'ar' ? '(مستحقة)' : '(payable)') : (lang === 'ar' ? '(مطالب بها)' : '(refundable)')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * TaxReportTab — تقرير الضرائب مطابق لنموذج الإفصاح الضريبي السعودي (مصلحة الزكاة والضريبة والجمارك)
 * نموذج إقرار ضريبة القيمة المضافة — قابل للتعديل — يستورد من النظام المحاسبي
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useTaxReport } from '../../hooks/useReports';
import { exportToExcel } from '../../utils/exportUtils';
import { openPrintWindow } from '../../utils/printUtils';
import { fmtTax } from '../../utils/format';
import { Badge, Button, Checkbox, Input, FmtNum } from '../../ui';
import { TAX_REPORT_STORAGE_PREFIX } from '../../constants/storageKeys';
import { readJsonStorage, writeJsonStorage } from '../../utils/jsonStorage';
import {
  OUTPUT_ROWS,
  INPUT_ROWS,
  SUMMARY_ROWS,
  defaultDisclosureData,
  mergeImportedDisclosure,
  computeOutputTotal,
  computeInputTotal,
  computeNetPayable,
  getRowValue,
} from '../../constants/taxDisclosure';

function taxReportStorageKey(companyId: any, period: any) {
  return `${TAX_REPORT_STORAGE_PREFIX}_${companyId}_${period}`;
}

function loadStoredData(companyId: any, period: any) {
  const parsed = readJsonStorage(taxReportStorageKey(companyId, period), null);
  if (parsed && typeof parsed === 'object') {
    return { ...defaultDisclosureData(), ...parsed };
  }
  return defaultDisclosureData();
}

function saveStoredData(companyId: any, period: any, data: any) {
  writeJsonStorage(taxReportStorageKey(companyId, period), data);
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
type TaxDraftSource = 'system' | 'manualDraft';

export default function TaxReportTab() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState('Q1'); // Q1, Q2, Q3, Q4, M1..M12
  const [salesAmountIncludesVat, setSalesAmountIncludesVat] = useState(false);
  const periodKey = `${year}-${period}`;
  const [data, setData] = useState(() => loadStoredData(activeCompanyId || '', periodKey));
  const [draftSource, setDraftSource] = useState<TaxDraftSource>('system');

  const { data: importedData, isLoading: importLoading, refetch: refetchTax } = useTaxReport({
    companyId: activeCompanyId,
    year,
    period,
    salesAmountIncludesVat,
    enabled: !!activeCompanyId,
  });

  const company = companies?.find((c: any) => c.id === activeCompanyId);
  const companyName = lang === 'en' ? (company?.nameEn || company?.nameAr || '') : (company?.nameAr || company?.nameEn || '');
  const periodOptions = useMemo(() => {
    const opts = [];
    for (let q = 1; q <= 4; q++) opts.push({ value: `Q${q}`, label: lang === 'ar' ? `الربع ${q}` : `Q${q}` });
    for (let m = 1; m <= 12; m++) opts.push({ value: `M${m}`, label: EN_MONTHS[m - 1] });
    return opts;
  }, [lang]);

  useEffect(() => {
    setData((prev: any) => {
      const stored = loadStoredData(activeCompanyId || '', periodKey);
      return mergeImportedDisclosure(stored, importedData);
    });
    if (importedData) setDraftSource('system');
  }, [activeCompanyId, periodKey, importedData]);

  const handleImportFromSystem = () => {
    refetchTax().then((result: any) => {
      const imported = result?.data;
      if (imported) {
        const stored = loadStoredData(activeCompanyId || '', periodKey);
        const merged = mergeImportedDisclosure(stored, imported);
        setData(merged);
        setDraftSource('system');
        saveStoredData(activeCompanyId || '', periodKey, merged);
      }
    });
  };

  const outputTotal = useMemo(() => computeOutputTotal(data), [data]);
  const inputTotal = useMemo(() => computeInputTotal(data), [data]);
  const netPayable = useMemo(() => computeNetPayable(data), [data]);
  const priorAdj = getRowValue(data, 'prior_adjustments', 'amount');
  const balanceCarried = getRowValue(data, 'balance_carried', 'amount');
  const netVat = outputTotal - inputTotal;

  const handlePrint = () => {
    const label = (r: any) => (lang === 'ar' ? r.labelAr : r.labelEn);
    const outRows = OUTPUT_ROWS.map((r: any) => {
      const amt = r.isTotal ? outputTotal : getRowValue(data, r.key, 'amount');
      const vat = r.isTotal ? outputTotal : getRowValue(data, r.key, 'vat');
      return `<tr><td>${(label(r) || '').replace(/</g, '&lt;')}</td><td>${fmtTax(amt)}</td><td>${r.isTotal ? '—' : fmtTax(getRowValue(data, r.key, 'adjustment'))}</td><td>${fmtTax(vat)}</td></tr>`;
    }).join('');
    const inRows = INPUT_ROWS.map((r: any) => {
      const amt = r.isTotal ? inputTotal : getRowValue(data, r.key, 'amount');
      const vat = r.isTotal ? inputTotal : getRowValue(data, r.key, 'vat');
      return `<tr><td>${(label(r) || '').replace(/</g, '&lt;')}</td><td>${fmtTax(amt)}</td><td>${r.isTotal ? '—' : fmtTax(getRowValue(data, r.key, 'adjustment'))}</td><td>${fmtTax(vat)}</td></tr>`;
    }).join('');
    const vatTitle = lang === 'ar' ? 'نموذج الإفصاح الضريبي — ضريبة القيمة المضافة' : 'VAT Tax Disclosure Form';
    openPrintWindow({
      title: lang === 'ar' ? 'تقرير الضرائب' : 'Tax Report',
      companyName: companyName || '',
      subtitle: `${vatTitle} — ${periodKey}`,
      body: `<table><thead><tr><th>${t('reportItem')}</th><th>المبلغ (SR)</th><th>${lang === 'ar' ? 'التعديلات' : 'Adjustments'}</th><th>${lang === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}</th></tr></thead>
<tbody><tr><td colspan="4" style="background:#f0fdf4;font-weight:700">${lang === 'ar' ? 'مخرجات ضريبة القيمة المضافة (المبيعات)' : 'Output VAT (Sales)'}</td></tr>${outRows}
<tr><td colspan="4" style="background:#fef2f2;font-weight:700">${lang === 'ar' ? 'ضريبة المشتريات والمصروفات (ما سُجّلت ضريبته فقط)' : 'Purchases & expenses VAT (tax lines only)'}</td></tr>${inRows}
<tr><td colspan="4" style="background:#eff6ff;font-weight:700">${lang === 'ar' ? 'الملخص' : 'Summary'}</td></tr>
<tr><td>${lang === 'ar' ? 'إجمالي الضريبة المستحقة' : 'Total VAT due'}</td><td colspan="3">${fmtTax(outputTotal)} SR</td></tr>
<tr><td>${lang === 'ar' ? 'إجمالي ضريبة المشتريات والمصروفات (مسجّلة فقط)' : 'Total VAT on purchases & expenses (recorded only)'}</td><td colspan="3">${fmtTax(inputTotal)} SR</td></tr>
<tr><td>${lang === 'ar' ? 'صافي الضريبة' : 'Net VAT'}</td><td colspan="3">${fmtTax(netVat)} SR</td></tr>
<tr><td>${lang === 'ar' ? 'تصحيحات من الفترة السابقة' : 'Prior period adjustments'}</td><td colspan="3">${fmtTax(priorAdj)}</td></tr>
<tr><td>${lang === 'ar' ? 'رصيد مرحلة' : 'Balance carried forward'}</td><td colspan="3">${fmtTax(balanceCarried)}</td></tr>
<tr style="background:#dbeafe;font-weight:800"><td>${lang === 'ar' ? 'صافي الضريبة المستحقة أو المطالب بها' : 'Net VAT payable or refundable'}</td><td colspan="3">${fmtTax(netPayable)} SR</td></tr>
</tbody></table>`,
    });
  };

  const updateRow = (key: any, field: any, value: any) => {
    const num = parseFloat(String(value).replace(/,/g, '')) || 0;
    setData((prev: any) => {
      const next = { ...prev };
      const isSummaryField = !field || SUMMARY_ROWS.some((r: any) => r.key === key);
      if (isSummaryField) {
        next[key] = num;
      } else {
        next[key] = { ...(next[key] || { amount: 0, adjustment: 0, vat: 0 }), [field]: num };
      }
      saveStoredData(activeCompanyId || '', periodKey, next);
      setDraftSource('manualDraft');
      return next;
    });
  };

  const renderEditableCell = (key: any, field: any) => (
    <Input
      type="text"
      inputMode="decimal"
      value={getRowValue(data, key, field) || ''}
      onChange={(e: any) => updateRow(key, field, e.target.value)}
      placeholder="0"
    />
  );

  const exportData = useMemo(() => {
    const rows = [];
    const label = (r: any) => (lang === 'ar' ? r.labelAr : r.labelEn);
    OUTPUT_ROWS.forEach((r: any) => {
      if (r.isTotal) rows.push({ [t('reportItem')]: label(r), [lang === 'ar' ? 'المبلغ' : 'Amount']: outputTotal, [lang === 'ar' ? 'الضريبة' : 'VAT']: outputTotal });
      else rows.push({ [t('reportItem')]: label(r), [lang === 'ar' ? 'المبلغ' : 'Amount']: getRowValue(data, r.key, 'amount'), [lang === 'ar' ? 'الضريبة' : 'VAT']: getRowValue(data, r.key, 'vat') });
    });
    INPUT_ROWS.forEach((r: any) => {
      if (r.isTotal) rows.push({ [t('reportItem')]: label(r), [lang === 'ar' ? 'المبلغ' : 'Amount']: inputTotal, [lang === 'ar' ? 'الضريبة' : 'VAT']: inputTotal });
      else rows.push({ [t('reportItem')]: label(r), [lang === 'ar' ? 'المبلغ' : 'Amount']: getRowValue(data, r.key, 'amount'), [lang === 'ar' ? 'الضريبة' : 'VAT']: getRowValue(data, r.key, 'vat') });
    });
    rows.push({ [t('reportItem')]: label(SUMMARY_ROWS.find((r: any) => r.key === 'net_payable_refund')), [lang === 'ar' ? 'المبلغ' : 'Amount']: netPayable });
    return rows;
  }, [data, outputTotal, inputTotal, netPayable, lang, t]);

  const handleExportExcel = () => {
    exportToExcel(exportData, `tax-disclosure-${periodKey}.xlsx`);
  };

  return (
    <div className="grid gap-6">
      <div className="nx-page-header">
        <div>
          <h2 className="text-[18px] font-bold m-0">{lang === 'ar' ? 'تقرير الضرائب — نموذج الإفصاح الضريبي' : 'Tax Report — ZATCA Disclosure Form'}</h2>
          <p className="mt-1.5 text-[13px] text-noorix-muted">
            {lang === 'ar' ? 'مطابق لنموذج مصلحة الزكاة والضريبة والجمارك. جميع الحقول قابلة للتعديل.' : 'Matches ZATCA tax disclosure form. All fields are editable.'}
          </p>
        </div>
          <div className="mt-2">
            <Badge color={draftSource === 'manualDraft' ? 'amber' : 'blue'} size="sm" dot>
              {draftSource === 'manualDraft'
                ? (lang === 'ar' ? 'مسودة معدلة يدوياً' : 'Manual draft')
                : (lang === 'ar' ? 'مستورد من النظام' : 'Imported from system')}
            </Badge>
          </div>
        <div className="nx-toolbar flex-wrap">
          <label className="flex max-w-[min(100%,22rem)] cursor-pointer items-start gap-2 rounded-lg border border-noorix-border bg-[var(--noorix-blue-6)] px-3 py-2 text-[11px] leading-snug text-noorix-text">
            <Checkbox
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-noorix-border"
              checked={salesAmountIncludesVat}
              onChange={(e: any) => setSalesAmountIncludesVat(e.target.checked)}
            />
            <span>
              <span className="font-semibold">{t('taxImportSalesInclusiveLabel')}</span>
              <span className="block text-noorix-muted mt-0.5">{t('taxImportSalesInclusiveHint')}</span>
            </span>
          </label>
          <Input type="select" label={t('reportYear')} value={year} onChange={(e: any) => setYear(Number(e.target.value))}>
            {[currentYear, currentYear - 1, currentYear - 2].map((y: any) => <option key={y} value={y}>{y}</option>)}
          </Input>
          <Input type="select" label={lang === 'ar' ? 'الفترة' : 'Period'} value={period} onChange={(e: any) => setPeriod(e.target.value)}>
            {periodOptions.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Input>
          <Button size="sm" onClick={handleImportFromSystem} disabled={!activeCompanyId || importLoading}>
            {importLoading ? t('loading') : (lang === 'ar' ? 'استيراد من النظام' : 'Import from system')}
          </Button>
          <Button size="sm" onClick={handlePrint}>{t('print')}</Button>
          <Button size="sm" onClick={handleExportExcel}>{t('exportExcel')}</Button>
        </div>
      </div>

      {!activeCompanyId ? (
        <div className="noorix-surface-card p-5 text-center text-noorix-muted">
          {t('pleaseSelectCompany')}
        </div>
      ) : (
        <div className="noorix-surface-card overflow-hidden p-0">
          <div className="p-4 border-b border-noorix-border bg-noorix-surface">
            <div className="text-[14px] font-bold text-noorix-blue">{companyName}</div>
            <div className="text-[12px] text-noorix-muted mt-1">
              {lang === 'ar' ? 'نموذج الإفصاح الضريبي — ضريبة القيمة المضافة' : 'VAT Tax Disclosure Form'} — {periodKey}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className="text-end border-b border-noorix-border font-bold py-[10px] px-3 w-[280px] bg-[var(--noorix-table-header-bg)]">
                    {t('reportItem')}
                  </th>
                  <th className="text-center border-b border-noorix-border font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)]">
                    المبلغ (SR)
                  </th>
                  <th className="text-center border-b border-noorix-border font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)]">
                    التعديلات (SR)
                  </th>
                  <th className="text-center border-b border-noorix-border font-bold py-[10px] px-3 bg-[var(--noorix-table-header-bg)]">
                    ضريبة القيمة المضافة (SR)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="font-bold text-noorix-green py-[10px] px-3 bg-[var(--noorix-green-6)]">
                    {lang === 'ar' ? 'مخرجات ضريبة القيمة المضافة (المبيعات)' : 'Output VAT (Sales)'}
                  </td>
                </tr>
                {OUTPUT_ROWS.map((r: any) => (
                  <tr key={r.key} style={{ background: r.isTotal ? 'var(--noorix-navy-4)' : undefined }}>
                    <td className="border-b border-noorix-border py-[10px] px-3" style={{ fontWeight: r.isTotal ? 700 : 500 }}>
                      {lang === 'ar' ? r.labelAr : r.labelEn}
                    </td>
                    <td className="text-center border-b border-noorix-border py-2 px-3">
                      {r.isTotal ? fmtTax(outputTotal) : renderEditableCell(r.key, 'amount')}
                    </td>
                    <td className="text-center border-b border-noorix-border py-2 px-3">
                      {r.isTotal ? '—' : renderEditableCell(r.key, 'adjustment')}
                    </td>
                    <td className="text-center border-b border-noorix-border nx-font-numbers py-2 px-3">
                      {r.isTotal ? fmtTax(outputTotal) : renderEditableCell(r.key, 'vat')}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="font-bold text-noorix-red py-[10px] px-3 bg-[var(--noorix-red-6)]">
                    {lang === 'ar' ? 'ضريبة المشتريات والمصروفات (ما سُجّلت ضريبته فقط)' : 'Purchases & expenses VAT (tax lines only)'}
                  </td>
                </tr>
                {INPUT_ROWS.map((r: any) => (
                  <tr key={r.key} style={{ background: r.isTotal ? 'var(--noorix-navy-4)' : undefined }}>
                    <td className="border-b border-noorix-border py-[10px] px-3" style={{ fontWeight: r.isTotal ? 700 : 500 }}>
                      {lang === 'ar' ? r.labelAr : r.labelEn}
                    </td>
                    <td className="text-center border-b border-noorix-border py-2 px-3">
                      {r.isTotal ? fmtTax(inputTotal) : renderEditableCell(r.key, 'amount')}
                    </td>
                    <td className="text-center border-b border-noorix-border py-2 px-3">
                      {r.isTotal ? '—' : renderEditableCell(r.key, 'adjustment')}
                    </td>
                    <td className="text-center border-b border-noorix-border nx-font-numbers py-2 px-3">
                      {r.isTotal ? fmtTax(inputTotal) : renderEditableCell(r.key, 'vat')}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="font-bold text-noorix-text py-[10px] px-3 bg-[var(--noorix-blue-6)]">
                    {lang === 'ar' ? 'الملخص' : 'Summary'}
                  </td>
                </tr>
                <tr>
                  <td className="border-b border-noorix-border py-[10px] px-3">{lang === 'ar' ? 'إجمالي الضريبة المستحقة' : 'Total VAT due'}</td>
                  <td colSpan={3} className="border-b border-noorix-border text-end nx-font-numbers py-[10px] px-3"><FmtNum n={outputTotal} tax /> <span className="nx-sar">SR</span></td>
                </tr>
                <tr>
                  <td className="border-b border-noorix-border py-[10px] px-3">{lang === 'ar' ? 'إجمالي ضريبة المشتريات والمصروفات (مسجّلة فقط)' : 'Total VAT on purchases & expenses (recorded only)'}</td>
                  <td colSpan={3} className="border-b border-noorix-border text-end nx-font-numbers py-[10px] px-3"><FmtNum n={inputTotal} tax /> <span className="nx-sar">SR</span></td>
                </tr>
                <tr>
                  <td className="border-b border-noorix-border py-[10px] px-3">{lang === 'ar' ? 'صافي الضريبة' : 'Net VAT'}</td>
                  <td colSpan={3} className="border-b border-noorix-border text-end nx-font-numbers font-bold py-[10px] px-3"><FmtNum n={netVat} tax /> <span className="nx-sar">SR</span></td>
                </tr>
                <tr>
                  <td className="border-b border-noorix-border py-[10px] px-3">{lang === 'ar' ? 'تصحيحات من الفترة السابقة' : 'Prior period adjustments'}</td>
                  <td colSpan={3} className="border-b border-noorix-border text-center py-2 px-3">
                    <Input type="text" inputMode="decimal" value={priorAdj || ''} onChange={(e: any) => updateRow('prior_adjustments', null, e.target.value)} placeholder="0" />
                  </td>
                </tr>
                <tr>
                  <td className="border-b border-noorix-border py-[10px] px-3">{lang === 'ar' ? 'رصيد مرحلة' : 'Balance carried forward'}</td>
                  <td colSpan={3} className="border-b border-noorix-border text-center py-2 px-3">
                    <Input type="text" inputMode="decimal" value={balanceCarried || ''} onChange={(e: any) => updateRow('balance_carried', null, e.target.value)} placeholder="0" />
                  </td>
                </tr>
                <tr className="bg-[var(--noorix-blue-8)] border-t-2 border-noorix-blue">
                  <td className="font-extrabold p-3">{lang === 'ar' ? 'صافي الضريبة المستحقة أو المطالب بها' : 'Net VAT payable or refundable'}</td>
                  <td colSpan={3} className="text-end nx-font-numbers font-extrabold p-3" style={{ color: netPayable >= 0 ? 'var(--noorix-accent-red)' : 'var(--noorix-accent-green)' }}>
                    <FmtNum n={netPayable} tax /> <span className="nx-sar">SR</span> {netPayable >= 0 ? (lang === 'ar' ? '(مستحقة)' : '(payable)') : (lang === 'ar' ? '(مطالب بها)' : '(refundable)')}
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

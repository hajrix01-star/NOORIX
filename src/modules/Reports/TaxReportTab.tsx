import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useTaxReport } from '../../hooks/useReports';
import { exportToExcel } from '../../utils/exportUtils';
import { fmtTax } from '../../utils/format';
import { Badge, Button, Checkbox, FilterToolbar, FmtNum, Input, SearchableOptionsPicker, usePrintPreview } from '../../ui';
import {
  INPUT_ROWS,
  OUTPUT_ROWS,
  getRowValue,
  mergeImportedDisclosure,
  type TaxDisclosureData,
  type TaxDisclosureField,
  type TaxDisclosureRowKey,
} from '../../constants/taxDisclosure';
import {
  buildTaxPeriodOptions,
  buildTaxReportExportRows,
  buildTaxReportPrintBody,
  computeTaxReportTotals,
  loadStoredTaxReportData,
  saveStoredTaxReportData,
  updateTaxDisclosureRow,
  type TaxDraftSource,
} from './taxReportTabModel';
import ReportDateFilter from './ReportDateFilter';

export default function TaxReportTab() {
  const { activeCompanyId, companies } = useApp();
  const { t, lang } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState('Q1');
  const [salesAmountIncludesVat, setSalesAmountIncludesVat] = useState(false);
  const periodKey = `${year}-${period}`;
  const [data, setData] = useState<TaxDisclosureData>(() => loadStoredTaxReportData(activeCompanyId || '', periodKey));
  const [draftSource, setDraftSource] = useState<TaxDraftSource>('system');

  const { data: importedData, isLoading: importLoading, refetch: refetchTax } = useTaxReport({
    companyId: activeCompanyId,
    year,
    period,
    salesAmountIncludesVat,
    enabled: !!activeCompanyId,
  });

  const company = companies?.find((item) => item.id === activeCompanyId);
  const companyName = lang === 'en'
    ? (company?.nameEn || company?.nameAr || '')
    : (company?.nameAr || company?.nameEn || '');
  const companyLogoUrl = String(company?.logoUrl || '').trim();
  const { openPrintDocumentPreview, printPreviewModal } = usePrintPreview({
    title: lang === 'ar' ? '?????? ???????' : 'Print preview',
    closeLabel: t('close') || '?????',
    printLabel: `${t('print')} / PDF`,
  });
  const periodOptions = useMemo(() => buildTaxPeriodOptions(lang), [lang]);

  useEffect(() => {
    const stored = loadStoredTaxReportData(activeCompanyId || '', periodKey);
    setData(mergeImportedDisclosure(stored, importedData));
    if (importedData) setDraftSource('system');
  }, [activeCompanyId, periodKey, importedData]);

  const totals = useMemo(() => computeTaxReportTotals(data), [data]);
  const { outputTotal, inputTotal, netPayable, priorAdj, balanceCarried, netVat } = totals;

  function handleImportFromSystem() {
    refetchTax().then((result) => {
      const imported = result.data;
      if (!imported) return;
      const stored = loadStoredTaxReportData(activeCompanyId || '', periodKey);
      const merged = mergeImportedDisclosure(stored, imported);
      setData(merged);
      setDraftSource('system');
      saveStoredTaxReportData(activeCompanyId || '', periodKey, merged);
    });
  }

  function handlePrint() {
    const vatTitle = lang === 'ar' ? 'نموذج الإفصاح الضريبي - ضريبة القيمة المضافة' : 'VAT Tax Disclosure Form';
    openPrintDocumentPreview({
      title: lang === 'ar' ? 'تقرير الضرائب' : 'Tax Report',
      companyName: companyName || '',
      logoUrl: companyLogoUrl,
      subtitle: `${vatTitle} - ${periodKey}`,
      body: buildTaxReportPrintBody({ data, totals, lang, t }),
    });
  }

  function updateRow(key: TaxDisclosureRowKey, field: TaxDisclosureField | null, value: unknown) {
    setData((prev) => {
      const next = updateTaxDisclosureRow(prev, key, field, value);
      saveStoredTaxReportData(activeCompanyId || '', periodKey, next);
      setDraftSource('manualDraft');
      return next;
    });
  }

  function renderEditableCell(key: TaxDisclosureRowKey, field: TaxDisclosureField) {
    return (
      <Input
        type="text"
        inputMode="decimal"
        value={getRowValue(data, key, field) || ''}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow(key, field, event.target.value)}
        placeholder="0"
      />
    );
  }

  const exportData = useMemo(
    () => buildTaxReportExportRows({ data, totals, lang, t }),
    [data, totals, lang, t],
  );

  function handleExportExcel() {
    void exportToExcel(exportData, `tax-disclosure-${periodKey}.xlsx`);
  }

  return (
    <div className="grid gap-6">
      <div className="nx-page-header">
        <div>
          <h2 className="m-0 text-[18px] font-bold">
            {lang === 'ar' ? 'تقرير الضرائب - نموذج الإفصاح الضريبي' : 'Tax Report - ZATCA Disclosure Form'}
          </h2>
          <p className="mt-1.5 text-[13px] text-noorix-muted">
            {lang === 'ar'
              ? 'مطابق لنموذج مصلحة الزكاة والضريبة والجمارك. جميع الحقول قابلة للتعديل.'
              : 'Matches ZATCA tax disclosure form. All fields are editable.'}
          </p>
        </div>
        <div className="mt-2">
          <Badge color={draftSource === 'manualDraft' ? 'amber' : 'blue'} size="sm" dot>
            {draftSource === 'manualDraft'
              ? (lang === 'ar' ? 'مسودة معدلة يدويا' : 'Manual draft')
              : (lang === 'ar' ? 'مستورد من النظام' : 'Imported from system')}
          </Badge>
        </div>
        <FilterToolbar filtersClassName="nx-toolbar flex-wrap">
          <label className="flex max-w-[min(100%,22rem)] cursor-pointer items-start gap-2 rounded-lg border border-noorix-border bg-[var(--noorix-blue-6)] px-3 py-2 text-[11px] leading-snug text-noorix-text">
            <Checkbox
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-noorix-border"
              checked={salesAmountIncludesVat}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSalesAmountIncludesVat(event.target.checked)}
            />
            <span>
              <span className="font-semibold">{t('taxImportSalesInclusiveLabel')}</span>
              <span className="mt-0.5 block text-noorix-muted">{t('taxImportSalesInclusiveHint')}</span>
            </span>
          </label>
          <ReportDateFilter onYearChange={setYear} />
          <div className="w-full min-w-0 sm:w-[min(100%,11rem)]">
            <SearchableOptionsPicker
              label={lang === 'ar' ? 'الفترة' : 'Period'}
              value={period}
              onChange={setPeriod}
              options={periodOptions}
              aria-label={lang === 'ar' ? 'الفترة' : 'Period'}
            />
          </div>
          <Button size="sm" onClick={handleImportFromSystem} disabled={!activeCompanyId || importLoading}>
            {importLoading ? t('loading') : (lang === 'ar' ? 'استيراد من النظام' : 'Import from system')}
          </Button>
          <Button size="sm" onClick={handlePrint}>{t('print')}</Button>
          <Button size="sm" onClick={handleExportExcel}>{t('exportExcel')}</Button>
        </FilterToolbar>
      </div>

      {!activeCompanyId ? (
        <div className="noorix-surface-card p-5 text-center text-noorix-muted">
          {t('pleaseSelectCompany')}
        </div>
      ) : (
        <div className="noorix-surface-card overflow-hidden p-0">
          <div className="border-b border-noorix-border bg-noorix-surface p-4">
            <div className="text-[14px] font-bold text-noorix-blue">{companyName}</div>
            <div className="mt-1 text-[12px] text-noorix-muted">
              {lang === 'ar' ? 'نموذج الإفصاح الضريبي - ضريبة القيمة المضافة' : 'VAT Tax Disclosure Form'} - {periodKey}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className="w-[280px] border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-[10px] text-end font-bold">
                    {t('reportItem')}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-[10px] text-center font-bold">
                    {lang === 'ar' ? 'المبلغ (SR)' : 'Amount (SR)'}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-[10px] text-center font-bold">
                    {lang === 'ar' ? 'التعديلات (SR)' : 'Adjustments (SR)'}
                  </th>
                  <th className="border-b border-noorix-border bg-[var(--noorix-table-header-bg)] px-3 py-[10px] text-center font-bold">
                    {lang === 'ar' ? 'ضريبة القيمة المضافة (SR)' : 'VAT (SR)'}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="bg-[var(--noorix-green-6)] px-3 py-[10px] font-bold text-noorix-green">
                    {lang === 'ar' ? 'مخرجات ضريبة القيمة المضافة (المبيعات)' : 'Output VAT (Sales)'}
                  </td>
                </tr>
                {OUTPUT_ROWS.map((row) => (
                  <tr key={row.key} className={row.isTotal ? 'bg-[var(--noorix-navy-4)]' : undefined}>
                    <td className={`border-b border-noorix-border px-3 py-[10px] ${row.isTotal ? 'font-bold' : 'font-medium'}`}>
                      {lang === 'ar' ? row.labelAr : row.labelEn}
                    </td>
                    <td className="border-b border-noorix-border px-3 py-2 text-center">
                      {row.isTotal ? fmtTax(outputTotal) : renderEditableCell(row.key, 'amount')}
                    </td>
                    <td className="border-b border-noorix-border px-3 py-2 text-center">
                      {row.isTotal ? '-' : renderEditableCell(row.key, 'adjustment')}
                    </td>
                    <td className="border-b border-noorix-border px-3 py-2 text-center nx-font-numbers">
                      {row.isTotal ? fmtTax(outputTotal) : renderEditableCell(row.key, 'vat')}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="bg-[var(--noorix-red-6)] px-3 py-[10px] font-bold text-noorix-red">
                    {lang === 'ar' ? 'ضريبة المشتريات والمصروفات (ما سجلت ضريبته فقط)' : 'Purchases & expenses VAT (tax lines only)'}
                  </td>
                </tr>
                {INPUT_ROWS.map((row) => (
                  <tr key={row.key} className={row.isTotal ? 'bg-[var(--noorix-navy-4)]' : undefined}>
                    <td className={`border-b border-noorix-border px-3 py-[10px] ${row.isTotal ? 'font-bold' : 'font-medium'}`}>
                      {lang === 'ar' ? row.labelAr : row.labelEn}
                    </td>
                    <td className="border-b border-noorix-border px-3 py-2 text-center">
                      {row.isTotal ? fmtTax(inputTotal) : renderEditableCell(row.key, 'amount')}
                    </td>
                    <td className="border-b border-noorix-border px-3 py-2 text-center">
                      {row.isTotal ? '-' : renderEditableCell(row.key, 'adjustment')}
                    </td>
                    <td className="border-b border-noorix-border px-3 py-2 text-center nx-font-numbers">
                      {row.isTotal ? fmtTax(inputTotal) : renderEditableCell(row.key, 'vat')}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="bg-[var(--noorix-blue-6)] px-3 py-[10px] font-bold text-noorix-text">
                    {lang === 'ar' ? 'الملخص' : 'Summary'}
                  </td>
                </tr>
                <tr>
                  <td className="border-b border-noorix-border px-3 py-[10px]">{lang === 'ar' ? 'إجمالي الضريبة المستحقة' : 'Total VAT due'}</td>
                  <td colSpan={3} className="border-b border-noorix-border px-3 py-[10px] text-end nx-font-numbers"><FmtNum n={outputTotal} tax /> <span className="nx-sar">SR</span></td>
                </tr>
                <tr>
                  <td className="border-b border-noorix-border px-3 py-[10px]">{lang === 'ar' ? 'إجمالي ضريبة المشتريات والمصروفات (مسجلة فقط)' : 'Total VAT on purchases & expenses (recorded only)'}</td>
                  <td colSpan={3} className="border-b border-noorix-border px-3 py-[10px] text-end nx-font-numbers"><FmtNum n={inputTotal} tax /> <span className="nx-sar">SR</span></td>
                </tr>
                <tr>
                  <td className="border-b border-noorix-border px-3 py-[10px]">{lang === 'ar' ? 'صافي الضريبة' : 'Net VAT'}</td>
                  <td colSpan={3} className="border-b border-noorix-border px-3 py-[10px] text-end font-bold nx-font-numbers"><FmtNum n={netVat} tax /> <span className="nx-sar">SR</span></td>
                </tr>
                <tr>
                  <td className="border-b border-noorix-border px-3 py-[10px]">{lang === 'ar' ? 'تصحيحات من الفترة السابقة' : 'Prior period adjustments'}</td>
                  <td colSpan={3} className="border-b border-noorix-border px-3 py-2 text-center">
                    <Input type="text" inputMode="decimal" value={priorAdj || ''} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow('prior_adjustments', null, event.target.value)} placeholder="0" />
                  </td>
                </tr>
                <tr>
                  <td className="border-b border-noorix-border px-3 py-[10px]">{lang === 'ar' ? 'رصيد مرحلة' : 'Balance carried forward'}</td>
                  <td colSpan={3} className="border-b border-noorix-border px-3 py-2 text-center">
                    <Input type="text" inputMode="decimal" value={balanceCarried || ''} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateRow('balance_carried', null, event.target.value)} placeholder="0" />
                  </td>
                </tr>
                <tr className="border-t-2 border-noorix-blue bg-[var(--noorix-blue-8)]">
                  <td className="p-3 font-extrabold">{lang === 'ar' ? 'صافي الضريبة المستحقة أو المطالب بها' : 'Net VAT payable or refundable'}</td>
                  <td colSpan={3} className={`p-3 text-end font-extrabold nx-font-numbers ${netPayable >= 0 ? 'text-noorix-red' : 'text-noorix-green'}`}>
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

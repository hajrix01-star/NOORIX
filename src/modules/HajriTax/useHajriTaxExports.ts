import { useCallback } from 'react';
import {
  INPUT_ROWS,
  OUTPUT_ROWS,
  computeNetPayable,
  defaultDisclosureData,
  getRowValue,
  type TaxDisclosureData,
  type TaxDisclosureLineRow,
} from '../../constants/taxDisclosure';
import { exportToExcel } from '../../utils/exportUtils';
import { fmt, fmtTax } from '../../utils/format';
import { openPrintWindow } from '../../utils/printUtils';
import type { HajriTaxLanguage, HajriTaxTranslate, VatPlanningRecord } from '../../types/api/domains/hajriTax';
import { companyDisplayName, isHajriDeclarationSubmitted, registryInputVat, registryOutputVat, registryPayload, registryPurchasesAmount, registrySalesAmount } from './hajriRegistryMetrics';
import { escapeHtml, fmtDisclosurePrintCell } from './hajriTaxScreenHelpers';

type CompanyMeta = (id: string | null) => { name: string; tax: string };

type HajriTaxExportsParams = {
  t: HajriTaxTranslate;
  lang: HajriTaxLanguage;
  detailCompanyId: string | null;
  companyMeta: CompanyMeta;
  draftData: TaxDisclosureData;
  outputTotal: number;
  inputTotal: number;
  netPayableDraft: number;
  paymentTargetStr: string;
  periodLabel: string;
  registryRows: VatPlanningRecord[];
  currentYear: number;
};

function parseDisplayPaymentTarget(value: string): number | null {
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) && Math.abs(parsed) > 1e-9 ? parsed : null;
}

export function useHajriTaxExports({
  t,
  lang,
  detailCompanyId,
  companyMeta,
  draftData,
  outputTotal,
  inputTotal,
  netPayableDraft,
  paymentTargetStr,
  periodLabel,
  registryRows,
  currentYear,
}: HajriTaxExportsParams) {
  const printDetail = useCallback(() => {
    const { name } = companyMeta(detailCompanyId);
    const label = (row: TaxDisclosureLineRow) => (lang === 'ar' ? row.labelAr : row.labelEn);
    const outRows = OUTPUT_ROWS.map((row) => {
      const amount = row.isTotal ? outputTotal : getRowValue(draftData, row.key, 'amount');
      const vat = row.isTotal ? outputTotal : getRowValue(draftData, row.key, 'vat');
      const adjustment = row.isTotal ? '-' : fmtDisclosurePrintCell(getRowValue(draftData, row.key, 'adjustment'));
      return `<tr><td>${escapeHtml(label(row))}</td><td>${fmtDisclosurePrintCell(amount)}</td><td>${adjustment}</td><td>${fmtDisclosurePrintCell(vat)}</td></tr>`;
    }).join('');
    const inRows = INPUT_ROWS.map((row) => {
      const amount = row.isTotal ? inputTotal : getRowValue(draftData, row.key, 'amount');
      const vat = row.isTotal ? inputTotal : getRowValue(draftData, row.key, 'vat');
      const adjustment = row.isTotal ? '-' : fmtDisclosurePrintCell(getRowValue(draftData, row.key, 'adjustment'));
      return `<tr><td>${escapeHtml(label(row))}</td><td>${fmtDisclosurePrintCell(amount)}</td><td>${adjustment}</td><td>${fmtDisclosurePrintCell(vat)}</td></tr>`;
    }).join('');
    const paymentTarget = parseDisplayPaymentTarget(paymentTargetStr);
    openPrintWindow({
      title: t('hajriTax'),
      companyName: name || '',
      subtitle: `${periodLabel} - ${lang === 'ar' ? 'تخطيط ضريبي لا يؤثر على المحاسبة' : 'Planning only, no accounting impact'}`,
      body: `<p>${lang === 'ar' ? 'مبلغ الدفع المستهدف:' : 'Target payment:'} ${paymentTarget == null ? '-' : `${fmtTax(paymentTarget)} SR`}</p>
<table><thead><tr><th>${t('reportItem')}</th><th>SR</th><th>${lang === 'ar' ? 'تعديل' : 'Adj.'}</th><th>VAT</th></tr></thead>
<tbody><tr><td colspan="4" style="background:#f0fdf4;font-weight:700">${lang === 'ar' ? 'مخرجات ضريبة القيمة المضافة' : 'Output VAT'}</td></tr>${outRows}
<tr><td colspan="4" style="background:#fef2f2;font-weight:700">${lang === 'ar' ? 'مدخلات ضريبة القيمة المضافة' : 'Input VAT'}</td></tr>${inRows}</tbody></table>
<p><b>${lang === 'ar' ? 'صافي مستحق' : 'Net payable'}:</b> ${fmtTax(netPayableDraft)} SR</p>`,
    });
  }, [companyMeta, detailCompanyId, draftData, inputTotal, lang, netPayableDraft, outputTotal, paymentTargetStr, periodLabel, t]);

  const exportDetailExcel = useCallback(() => {
    const rows: Array<{ Item: string; Amount: number | string; VAT: number }> = [];
    const label = (row: TaxDisclosureLineRow) => (lang === 'ar' ? row.labelAr : row.labelEn);
    OUTPUT_ROWS.forEach((row) => {
      if (!row.isTotal) rows.push({ Item: label(row), Amount: getRowValue(draftData, row.key, 'amount'), VAT: getRowValue(draftData, row.key, 'vat') });
    });
    INPUT_ROWS.forEach((row) => {
      if (!row.isTotal) rows.push({ Item: label(row), Amount: getRowValue(draftData, row.key, 'amount'), VAT: getRowValue(draftData, row.key, 'vat') });
    });
    rows.push({ Item: lang === 'ar' ? 'صافي مستحق' : 'Net payable', Amount: '', VAT: netPayableDraft });
    exportToExcel(rows, `hajri-tax-${detailCompanyId}-${periodLabel}.xlsx`);
  }, [detailCompanyId, draftData, lang, netPayableDraft, periodLabel]);

  const exportConsolidatedExcel = useCallback(() => {
    const rows = registryRows.map((row) => {
      const payload = registryPayload(row);
      const paymentTarget = row.paymentTarget != null ? parseFloat(String(row.paymentTarget)) : null;
      const submitted = isHajriDeclarationSubmitted(row);
      return {
        [lang === 'ar' ? 'الشركة' : 'Company']: companyDisplayName(row.company, lang),
        Year: row.year,
        Quarter: `Q${row.quarter}`,
        [t('hajriTaxColSales')]: registrySalesAmount(payload),
        [t('hajriTaxColPurchases')]: registryPurchasesAmount(payload),
        [t('hajriTaxColOutputVat')]: registryOutputVat(payload),
        [t('hajriTaxColInputVat')]: registryInputVat(payload),
        [t('vatNetPayable')]: computeNetPayable(payload),
        [t('vatPaymentTarget')]: Number.isFinite(paymentTarget) ? paymentTarget : '',
        [t('hajriTaxColFiling')]: submitted ? t('hajriTaxSubmittedYes') : t('hajriTaxSubmittedNo'),
        [t('vatNotes')]: row.notes || '',
        [t('vatLastUpdated')]: row.updatedAt ? String(row.updatedAt).slice(0, 19) : '-',
      };
    });
    exportToExcel(rows, `hajri-tax-registry-${currentYear}.xlsx`);
  }, [currentYear, lang, registryRows, t]);

  const printConsolidated = useCallback(() => {
    const bodyRows = registryRows.map((row) => {
      const payload = registryPayload(row);
      const paymentTarget = row.paymentTarget != null ? parseFloat(String(row.paymentTarget)) : null;
      const submitted = isHajriDeclarationSubmitted(row);
      return `<tr><td>${escapeHtml(companyDisplayName(row.company, lang))}</td><td>${row.year}</td><td>Q${row.quarter}</td><td>${fmt(registrySalesAmount(payload), 2)} SR</td><td>${fmt(registryPurchasesAmount(payload), 2)} SR</td><td>${fmtTax(registryOutputVat(payload))} SR</td><td>${fmtTax(registryInputVat(payload))} SR</td><td>${fmtTax(computeNetPayable(payload))} SR</td><td>${paymentTarget != null && Number.isFinite(paymentTarget) ? `${fmtTax(paymentTarget)} SR` : '-'}</td><td>${escapeHtml(submitted ? t('hajriTaxSubmittedYes') : t('hajriTaxSubmittedNo'))}</td><td>${escapeHtml(row.notes || '')}</td></tr>`;
    }).join('');
    openPrintWindow({
      title: `${t('hajriTax')} - ${lang === 'ar' ? 'السجل' : 'Registry'}`,
      companyName: '',
      subtitle: '',
      body: `<table class="w-full"><thead><tr><th>${lang === 'ar' ? 'الشركة' : 'Company'}</th><th>${lang === 'ar' ? 'السنة' : 'Year'}</th><th>${t('vatQuarter')}</th><th>${t('hajriTaxColSales')}</th><th>${t('hajriTaxColPurchases')}</th><th>${t('hajriTaxColOutputVat')}</th><th>${t('hajriTaxColInputVat')}</th><th>${t('vatNetPayable')}</th><th>${t('vatPaymentTarget')}</th><th>${t('hajriTaxColFiling')}</th><th>${t('vatNotes')}</th></tr></thead><tbody>${bodyRows}</tbody></table>`,
    });
  }, [lang, registryRows, t]);

  const exportJsonBundle = useCallback(() => {
    const records = registryRows.map((row) => ({
      companyId: row.companyId,
      year: row.year,
      quarter: row.quarter,
      payload: row.payload && typeof row.payload === 'object' ? row.payload : defaultDisclosureData(),
      paymentTarget: row.paymentTarget ?? null,
      notes: row.notes ?? null,
      sourceSnapshot: row.sourceSnapshot ?? null,
    }));
    const blob = new Blob(
      [JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), records }, null, 2)],
      { type: 'application/json' },
    );
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = 'hajri-tax-registry-export.json';
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }, [registryRows]);

  return {
    printDetail,
    exportDetailExcel,
    exportConsolidatedExcel,
    printConsolidated,
    exportJsonBundle,
  };
}

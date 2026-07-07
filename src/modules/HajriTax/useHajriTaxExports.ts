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
import { buildPrintHtmlTable, type PrintHtmlTableRow } from '../../utils/printTableHtml';
import { openPrintWindow } from '../../utils/printUtils';
import type { HajriTaxLanguage, HajriTaxTranslate, VatPlanningRecord } from '../../types/api/domains/hajriTax';
import {
  companyDisplayName,
  isHajriDeclarationSubmitted,
  registryInputVat,
  registryOutputVat,
  registryPayload,
  registryPurchasesAmount,
  registrySalesAmount,
} from './hajriRegistryMetrics';
import { fmtDisclosurePrintCell } from './hajriTaxScreenHelpers';

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

const AR = {
  planningNoAccountingImpact: '\u062a\u062e\u0637\u064a\u0637 \u0636\u0631\u064a\u0628\u064a \u0644\u0627 \u064a\u0624\u062b\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u062d\u0627\u0633\u0628\u0629',
  targetPayment: '\u0645\u0628\u0644\u063a \u0627\u0644\u062f\u0641\u0639 \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641:',
  adjustment: '\u062a\u0639\u062f\u064a\u0644',
  outputVat: '\u0645\u062e\u0631\u062c\u0627\u062a \u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629',
  inputVat: '\u0645\u062f\u062e\u0644\u0627\u062a \u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629',
  netPayable: '\u0635\u0627\u0641\u064a \u0645\u0633\u062a\u062d\u0642',
  registry: '\u0627\u0644\u0633\u062c\u0644',
  company: '\u0627\u0644\u0634\u0631\u0643\u0629',
  year: '\u0627\u0644\u0633\u0646\u0629',
};

function parseDisplayPaymentTarget(value: string): number | null {
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) && Math.abs(parsed) > 1e-9 ? parsed : null;
}

function taxLineRows(params: {
  rows: readonly TaxDisclosureLineRow[];
  data: TaxDisclosureData;
  total: number;
  lang: HajriTaxLanguage;
}): PrintHtmlTableRow[] {
  const { rows, data, total, lang } = params;
  const label = (row: TaxDisclosureLineRow) => (lang === 'ar' ? row.labelAr : row.labelEn);
  return rows.map((row) => {
    const amount = row.isTotal ? total : getRowValue(data, row.key, 'amount');
    const vat = row.isTotal ? total : getRowValue(data, row.key, 'vat');
    const adjustment = row.isTotal ? '-' : fmtDisclosurePrintCell(getRowValue(data, row.key, 'adjustment'));
    return {
      cells: [
        { value: label(row) },
        { value: fmtDisclosurePrintCell(amount), align: 'end' },
        { value: adjustment, align: 'end' },
        { value: fmtDisclosurePrintCell(vat), align: 'end' },
      ],
    };
  });
}

function taxSectionRow(label: string, background: string): PrintHtmlTableRow {
  return {
    cells: [{ value: label, colSpan: 4, style: `background:${background};font-weight:700` }],
  };
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
    const paymentTarget = parseDisplayPaymentTarget(paymentTargetStr);
    const detailTable = buildPrintHtmlTable({
      wrapperClassName: null,
      headerRows: [{
        cells: [
          { value: t('reportItem') },
          { value: 'SR', align: 'end' },
          { value: lang === 'ar' ? AR.adjustment : 'Adj.', align: 'end' },
          { value: 'VAT', align: 'end' },
        ],
      }],
      bodyRows: [
        taxSectionRow(lang === 'ar' ? AR.outputVat : 'Output VAT', '#f0fdf4'),
        ...taxLineRows({ rows: OUTPUT_ROWS, data: draftData, total: outputTotal, lang }),
        taxSectionRow(lang === 'ar' ? AR.inputVat : 'Input VAT', '#fef2f2'),
        ...taxLineRows({ rows: INPUT_ROWS, data: draftData, total: inputTotal, lang }),
      ],
    });
    openPrintWindow({
      title: t('hajriTax'),
      companyName: name || '',
      subtitle: `${periodLabel} - ${lang === 'ar' ? AR.planningNoAccountingImpact : 'Planning only, no accounting impact'}`,
      body: `<p>${lang === 'ar' ? AR.targetPayment : 'Target payment:'} ${paymentTarget == null ? '-' : `${fmtTax(paymentTarget)} SR`}</p>
${detailTable}
<p><b>${lang === 'ar' ? AR.netPayable : 'Net payable'}:</b> ${fmtTax(netPayableDraft)} SR</p>`,
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
    rows.push({ Item: lang === 'ar' ? AR.netPayable : 'Net payable', Amount: '', VAT: netPayableDraft });
    exportToExcel(rows, `hajri-tax-${detailCompanyId}-${periodLabel}.xlsx`);
  }, [detailCompanyId, draftData, lang, netPayableDraft, periodLabel]);

  const exportConsolidatedExcel = useCallback(() => {
    const rows = registryRows.map((row) => {
      const payload = registryPayload(row);
      const paymentTarget = row.paymentTarget != null ? parseFloat(String(row.paymentTarget)) : null;
      const submitted = isHajriDeclarationSubmitted(row);
      return {
        [lang === 'ar' ? AR.company : 'Company']: companyDisplayName(row.company, lang),
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
    openPrintWindow({
      title: `${t('hajriTax')} - ${lang === 'ar' ? AR.registry : 'Registry'}`,
      companyName: '',
      subtitle: '',
      body: buildPrintHtmlTable({
        tableClassName: 'w-full',
        wrapperClassName: null,
        headerRows: [{
          cells: [
            { value: lang === 'ar' ? AR.company : 'Company' },
            { value: lang === 'ar' ? AR.year : 'Year' },
            { value: t('vatQuarter') },
            { value: t('hajriTaxColSales'), align: 'end' },
            { value: t('hajriTaxColPurchases'), align: 'end' },
            { value: t('hajriTaxColOutputVat'), align: 'end' },
            { value: t('hajriTaxColInputVat'), align: 'end' },
            { value: t('vatNetPayable'), align: 'end' },
            { value: t('vatPaymentTarget'), align: 'end' },
            { value: t('hajriTaxColFiling') },
            { value: t('vatNotes') },
          ],
        }],
        bodyRows: registryRows.map((row) => {
          const payload = registryPayload(row);
          const paymentTarget = row.paymentTarget != null ? parseFloat(String(row.paymentTarget)) : null;
          const submitted = isHajriDeclarationSubmitted(row);
          return {
            cells: [
              { value: companyDisplayName(row.company, lang) },
              { value: row.year },
              { value: `Q${row.quarter}` },
              { value: `${fmt(registrySalesAmount(payload), 2)} SR`, align: 'end' },
              { value: `${fmt(registryPurchasesAmount(payload), 2)} SR`, align: 'end' },
              { value: `${fmtTax(registryOutputVat(payload))} SR`, align: 'end' },
              { value: `${fmtTax(registryInputVat(payload))} SR`, align: 'end' },
              { value: `${fmtTax(computeNetPayable(payload))} SR`, align: 'end' },
              { value: paymentTarget != null && Number.isFinite(paymentTarget) ? `${fmtTax(paymentTarget)} SR` : '-', align: 'end' },
              { value: submitted ? t('hajriTaxSubmittedYes') : t('hajriTaxSubmittedNo') },
              { value: row.notes || '' },
            ],
          };
        }),
      }),
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

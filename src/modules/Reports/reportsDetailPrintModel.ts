import { fmt } from '../../utils/format';
import { buildPrintHtmlTable } from '../../utils/printTableHtml';
import type { PrintDocumentHtmlOptions } from '../../utils/printUtils';
import { toYmd } from '../../utils/saudiDate';
import {
  reportDetailItemLabel,
  reportDetailSourceName,
  type ReportDetailItem,
  type ReportsDetailData,
  type TranslateFn,
} from './reportsDetailModel';

type BuildReportsDetailPrintDocumentInput = {
  data: ReportsDetailData;
  year: number | null | undefined;
  t: TranslateFn;
  lang: string;
  companyName: string;
  companyLogoUrl: string;
};

export function buildReportsDetailPrintDocument({
  data,
  year,
  t,
  lang,
  companyName,
  companyLogoUrl,
}: BuildReportsDetailPrintDocumentInput): PrintDocumentHtmlOptions {
  const htmlDir = lang === 'en' ? 'ltr' : 'rtl';
  const htmlLang = lang === 'en' ? 'en' : 'ar';
  const title = lang === 'en' ? data.titleEn : data.titleAr;
  const subtitleParts = [String(year), data.monthLabel, t('reportAmountBasisGross')].filter(Boolean);
  const detailItems = data.items ?? [];
  const body = data.kind === 'derived'
    ? buildDerivedDetailsPrintTable(detailItems, t, lang)
    : buildInvoiceDetailsPrintTable(data, detailItems, t, lang);

  return {
    title: t('reportDetails'),
    companyName: companyName || t('reports'),
    logoUrl: companyLogoUrl,
    subtitle: `${title} · ${subtitleParts.join(' · ')}`,
    body,
    landscape: data.kind === 'invoices',
    htmlDir,
    htmlLang,
  };
}

function buildDerivedDetailsPrintTable(detailItems: readonly ReportDetailItem[], t: TranslateFn, lang: string) {
  return buildPrintHtmlTable({
    wrapperClassName: null,
    headerRows: [{
      cells: [
        { value: t('reportItem') },
        { value: t('reportAmountInclTax'), align: 'end' },
      ],
    }],
    bodyRows: detailItems.map((item) => ({
      cells: [
        { value: reportDetailItemLabel(item, lang) },
        { value: fmt(Number(item.amount)), align: 'end' },
      ],
    })),
  });
}

function buildInvoiceDetailsPrintTable(
  data: ReportsDetailData,
  detailItems: readonly ReportDetailItem[],
  t: TranslateFn,
  lang: string,
) {
  const isLedgerDetail = data.detailSource === 'ledger';
  return buildPrintHtmlTable({
    wrapperClassName: null,
    headerRows: [{
      cells: [
        { value: t('transactionDate') },
        { value: isLedgerDetail ? t('reportDocumentNumber') : t('reportInvoiceNumber') },
        { value: t('reportSourceOrSupplier') },
        { value: isLedgerDetail ? t('reportLedgerContribution') : t('reportAmountInclTax'), align: 'end' },
        { value: t('reportSalesShare'), align: 'end' },
        { value: t('notes') },
      ],
    }],
    bodyRows: detailItems.map((item) => ({
      cells: [
        { value: toYmd(item.transactionDate) },
        { value: item.summaryNumber || item.invoiceNumber || '—' },
        { value: reportDetailSourceName(item, lang) },
        { value: fmt(Number(item.reportAmount ?? item.totalAmount ?? 0)), align: 'end' },
        { value: item.percentOfSales == null ? '—' : `${item.percentOfSales}%`, align: 'end' },
        { value: item.notes || '—' },
      ],
    })),
  });
}

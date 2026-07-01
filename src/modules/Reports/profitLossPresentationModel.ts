import { KPI_CARD_SPARKLINE_COLORS } from '../../constants/kpiCardTheme';
import { formatSignedPercent, grossMargin, profitMargin } from '../../shared/reporting/plDisplaySelectors';
import { amountText } from './reportHelpers';
import type { GeneralProfitLossReport } from './reportTypes';

export const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type ProfitLossKpiKey = 'sales' | 'purchases' | 'expenses' | 'grossProfit' | 'netProfit';

export type ProfitLossKpiCardModel = {
  key: ProfitLossKpiKey;
  label: string;
  value: string;
  rawValue: number;
  periodLabel: string;
  color: string;
  profitPercent: string | null;
  isNegativeProfit: boolean;
};

export function getProfitLossMonthNames(lang: string) {
  return lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
}

export function getProfitLossCardRawValue(
  report: GeneralProfitLossReport | null | undefined,
  key: ProfitLossKpiKey,
  selectedMonthNumber: number | null,
) {
  if (!report) return 0;
  if (!selectedMonthNumber) return Number(report.cards?.[key] || 0);

  if (key === 'grossProfit' || key === 'netProfit') {
    return Number(report.summaryRows.find((row) => row.key === key)?.months?.[selectedMonthNumber - 1] || 0);
  }

  return Number(report.groups.find((row) => row.key === key)?.months?.[selectedMonthNumber - 1] || 0);
}

export function buildProfitLossKpiCards(input: {
  report: GeneralProfitLossReport | null | undefined;
  selectedMonthNumber: number | null;
  lang: string;
  year: number;
  t: (key: string) => string;
}): ProfitLossKpiCardModel[] {
  const { report, selectedMonthNumber, lang, year, t } = input;
  const monthNames = getProfitLossMonthNames(lang);
  const monthLabel = selectedMonthNumber ? monthNames[selectedMonthNumber - 1] : '';
  const periodLabel = selectedMonthNumber ? `${monthLabel} · ${year}` : String(year);
  const labelFor = (key: ProfitLossKpiKey) => {
    if (selectedMonthNumber) {
      if (key === 'sales') return `${monthLabel} — ${t('revenueGroup')}`;
      if (key === 'purchases') return `${monthLabel} — ${t('purchasesGroup')}`;
      if (key === 'expenses') return `${monthLabel} — ${t('expensesGroup')}`;
    }
    if (key === 'sales') return t('annualSales');
    if (key === 'purchases') return t('annualPurchases');
    if (key === 'expenses') return t('annualExpenses');
    if (key === 'grossProfit') return t('annualGrossProfit');
    return t('annualNetProfit');
  };

  return (['sales', 'purchases', 'expenses', 'grossProfit', 'netProfit'] as ProfitLossKpiKey[]).map((key) => {
    const rawValue = getProfitLossCardRawValue(report, key, selectedMonthNumber);
    const isProfit = key === 'grossProfit' || key === 'netProfit';
    const sales = getProfitLossCardRawValue(report, 'sales', selectedMonthNumber);
    const percent =
      !isProfit
        ? null
        : key === 'grossProfit'
          ? grossMargin(rawValue, sales)
          : profitMargin(rawValue, sales);

    return {
      key,
      label: labelFor(key),
      value: amountText(rawValue),
      rawValue,
      periodLabel,
      color: (KPI_CARD_SPARKLINE_COLORS as Record<string, string>)[key] || KPI_CARD_SPARKLINE_COLORS.sales,
      profitPercent: percent == null ? null : formatSignedPercent(percent),
      isNegativeProfit: isProfit && rawValue < 0,
    };
  });
}

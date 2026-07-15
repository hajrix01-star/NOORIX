import Decimal from 'decimal.js';
import { PERMISSIONS } from '../../auth/constants/permissions';
import { formatReportMoneyInteger, formatReportPercentNumber } from '../../common/utils/report-display-format.util';
import type { ChatHandler, ChatHandlerContext, ChatHandlerResult } from './types';
import { matches, thisMonthToDateRange } from './utils';

const AR_OUTFLOW_TITLE = '\u0627\u0644\u062e\u0627\u0631\u062c \u0639\u0644\u0649 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a';
const AR_PERIOD = '\u0627\u0644\u0641\u062a\u0631\u0629';
const AR_ITEM = '\u0627\u0644\u0628\u0646\u062f';
const AR_AMOUNT = '\u0627\u0644\u0645\u0628\u0644\u063a';
const AR_RATIO = '\u0627\u0644\u0646\u0633\u0628\u0629';
const AR_SALES = '\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a';
const AR_PURCHASES = '\u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a';
const AR_EXPENSES = '\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a';
const AR_TOTAL = '\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a';

const BUNDLE_PATTERNS = [
  '\u0646\u0633\u0628 \u0627\u0644\u062e\u0627\u0631\u062c \u0639\u0644\u0649 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a',
  '\u0646\u0633\u0628 \u0627\u0644\u0637\u0644\u0628 \u0639\u0644\u0649 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a',
  '\u0627\u0644\u0646\u0633\u0628 \u0627\u0644\u062a\u0634\u063a\u064a\u0644\u064a\u0629 \u0645\u0646 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a',
  '\u0646\u0633\u0628 \u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a \u0648\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0648\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a',
  'mtd operating ratios',
  'operating ratios vs sales',
];

const PURCHASES_PATTERNS = [
  '\u0646\u0633\u0628\u0629 \u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a \u0645\u0646 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a',
  '\u0646\u0633\u0628\u0629 \u0645\u0634\u062a\u0631\u064a\u0627\u062a \u0645\u0646 \u0645\u0628\u064a\u0639\u0627\u062a',
  'purchases as % of sales',
  'purchases as a percentage of sales',
];

const EXPENSES_PATTERNS = [
  '\u0646\u0633\u0628\u0629 \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0645\u0646 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a',
  '\u0646\u0633\u0628\u0629 \u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0645\u0646 \u0645\u0628\u064a\u0639\u0627\u062a',
  'expenses as % of sales',
  'expenses as a percentage of sales',
];

const TOTAL_PATTERNS = [
  '\u0646\u0633\u0628\u0629 \u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a \u0648\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0645\u0646 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a',
  '\u0646\u0633\u0628\u0629 \u0645\u0634\u062a\u0631\u064a\u0627\u062a \u0648\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0645\u0646 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a',
  '\u0645\u062c\u0645\u0648\u0639 \u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a \u0648\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0645\u0646 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a',
  'purchases plus expenses',
  'purchases and expenses as a share of sales',
];

function canSales(can: (p: string) => boolean): boolean {
  return can(PERMISSIONS.VIEW_SALES) || can(PERMISSIONS.SALES_READ);
}

function canPurchases(can: (p: string) => boolean): boolean {
  return can(PERMISSIONS.VIEW_INVOICES);
}

function canExpenses(can: (p: string) => boolean): boolean {
  return can(PERMISSIONS.VIEW_EXPENSES) || can(PERMISSIONS.EXPENSES_READ);
}

function pctOf(numer: Decimal, denom: Decimal): string {
  if (denom.lte(0)) return '';
  return `${formatReportPercentNumber(numer.div(denom).mul(100))}%`;
}

function fmtAmount(n: Decimal): string {
  return formatReportMoneyInteger(n);
}

function emptyAnswer(messageAr: string, messageEn: string, period?: { labelAr: string; labelEn: string }): ChatHandlerResult {
  const ar = [`## ${AR_OUTFLOW_TITLE}`];
  const en = ['## Outflow vs sales'];
  if (period) {
    ar.push(`${AR_PERIOD}: ${period.labelAr}`);
    en.push(`Period: ${period.labelEn}`);
  }
  ar.push(messageAr);
  en.push(messageEn);
  return { answerAr: ar.join('\n'), answerEn: en.join('\n') };
}

function buildRows(
  sales: Decimal,
  purchases: Decimal,
  expenses: Decimal,
  show: { purchases: boolean; expenses: boolean; total: boolean },
): { ar: string[]; en: string[] } {
  const total = purchases.plus(expenses);
  const ar = [`${AR_ITEM}\t${AR_AMOUNT}\t${AR_RATIO}`, `${AR_SALES}\t${fmtAmount(sales)}\t100%`];
  const en = ['Item\tAmount\tRatio', `Sales\t${fmtAmount(sales)}\t100%`];

  if (show.purchases) {
    ar.push(`${AR_PURCHASES}\t${fmtAmount(purchases)}\t${pctOf(purchases, sales)}`);
    en.push(`Purchases\t${fmtAmount(purchases)}\t${pctOf(purchases, sales)}`);
  }

  if (show.expenses) {
    ar.push(`${AR_EXPENSES}\t${fmtAmount(expenses)}\t${pctOf(expenses, sales)}`);
    en.push(`Expenses\t${fmtAmount(expenses)}\t${pctOf(expenses, sales)}`);
  }

  if (show.total) {
    ar.push(`${AR_TOTAL}\t${fmtAmount(total)}\t${pctOf(total, sales)}`);
    en.push(`Total\t${fmtAmount(total)}\t${pctOf(total, sales)}`);
  }

  return { ar, en };
}

function requestedRows(query: string, can: (p: string) => boolean): { purchases: boolean; expenses: boolean; total: boolean } {
  const bundle = matches(query, BUNDLE_PATTERNS);
  const wantsPurchases = bundle || matches(query, PURCHASES_PATTERNS);
  const wantsExpenses = bundle || matches(query, EXPENSES_PATTERNS);
  const wantsTotal = bundle || matches(query, TOTAL_PATTERNS);

  return {
    purchases: canPurchases(can) && wantsPurchases,
    expenses: canExpenses(can) && wantsExpenses,
    total: canPurchases(can) && canExpenses(can) && wantsTotal,
  };
}

export const financeRatiosHandler: ChatHandler = {
  priority: 7,
  intent: 'finance_ratios',
  matchesIntent: (intent, can) => intent === 'finance_ratios' && canSales(can),
  canHandle: (query, can) => {
    if (!canSales(can)) return false;
    return matches(query, BUNDLE_PATTERNS) || matches(query, PURCHASES_PATTERNS) || matches(query, EXPENSES_PATTERNS) || matches(query, TOTAL_PATTERNS);
  },
  process: async (ctx: ChatHandlerContext) => {
    if (!canSales(ctx.can)) return null;

    const show = requestedRows(ctx.query, ctx.can);
    if (!show.purchases && !show.expenses && !show.total) {
      return emptyAnswer(
        '\u0644\u0627 \u062a\u0648\u062c\u062f \u0635\u0644\u0627\u062d\u064a\u0629 \u0643\u0627\u0641\u064a\u0629 \u0644\u0639\u0631\u0636 \u0627\u0644\u0646\u0633\u0628.',
        'Not enough permissions to show ratios.',
      );
    }

    const period = ctx.period ?? thisMonthToDateRange(ctx.now);
    if (period.end.getTime() < period.start.getTime()) {
      return emptyAnswer(
        '\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u064a\u0627\u0645 \u0645\u0643\u062a\u0645\u0644\u0629 \u0644\u0644\u062d\u0633\u0627\u0628.',
        'No completed days are available for this period.',
        period,
      );
    }

    const sales = await ctx.chatFinancialMetrics.sumRevenue(ctx.companyId, period.start, period.end);
    const purchases = canPurchases(ctx.can)
      ? await ctx.chatFinancialMetrics.sumPurchases(ctx.companyId, period.start, period.end)
      : new Decimal(0);
    const expenses = canExpenses(ctx.can)
      ? await ctx.chatFinancialMetrics.sumOperatingExpenses(ctx.companyId, period.start, period.end)
      : new Decimal(0);

    if (sales.lte(0)) {
      return emptyAnswer(
        '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0628\u064a\u0639\u0627\u062a \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0641\u062a\u0631\u0629.',
        'No sales in this period.',
        period,
      );
    }

    const rows = buildRows(sales, purchases, expenses, show);
    return {
      answerAr: [`## ${AR_OUTFLOW_TITLE}`, `${AR_PERIOD}: ${period.labelAr}`, '', ...rows.ar].join('\n'),
      answerEn: ['## Outflow vs sales', `Period: ${period.labelEn}`, '', ...rows.en].join('\n'),
    };
  },
};

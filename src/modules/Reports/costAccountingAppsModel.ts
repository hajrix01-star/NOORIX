/**
 * نموذج معزول: ربح/خسارة تقديرية (تطبيقات × محلي × ضريبة × عمولة).
 * جميع العمليات بـ Decimal.js.
 */
import Decimal from 'decimal.js';
import { roundAmount, splitTaxFromTotal } from '../../utils/math-engine';

export type CostAppsCommissionBase = 'gross' | 'net';

export type CostAppsPlInput = {
  grossApp: Decimal;
  grossLocalCash: Decimal;
  grossLocalBank: Decimal;
  vatInclusive: boolean;
  /** نسبة ضريبة كعدد عشري، مثال 0.15 = 15% */
  vatRate: Decimal;
  /** 0–100 */
  commissionPct: Decimal;
  commissionBase: CostAppsCommissionBase;
  fixedTotal: Decimal;
  /** false = لا مبيعات تطبيقات ولا عمولة (مقارنة) */
  includeAppChannel: boolean;
};

export type CostAppsPlResult = {
  grossApp: Decimal;
  grossLocalCash: Decimal;
  grossLocalBank: Decimal;
  grossLocal: Decimal;
  grossTotal: Decimal;
  netSales: Decimal;
  vatAmount: Decimal;
  commission: Decimal;
  fixedTotal: Decimal;
  netProfit: Decimal;
  appShareOfGrossPct: Decimal;
};

function d(v: string | number | Decimal): Decimal {
  try {
    return new Decimal(v ?? 0);
  } catch {
    return new Decimal(0);
  }
}

export function computeCostAppsPl(inp: CostAppsPlInput): CostAppsPlResult {
  const gAppRaw = d(inp.grossApp);
  const gCash = d(inp.grossLocalCash);
  const gBank = d(inp.grossLocalBank);
  const gApp = inp.includeAppChannel ? gAppRaw : new Decimal(0);
  const gLocal = gCash.plus(gBank);
  const grossTotal = gApp.plus(gLocal);

  const rateNum = inp.vatRate.toNumber();
  const { net: nApp, tax: tApp } = splitTaxFromTotal(gApp, inp.vatInclusive, rateNum);
  const { net: nCash, tax: tCash } = splitTaxFromTotal(gCash, inp.vatInclusive, rateNum);
  const { net: nBank, tax: tBank } = splitTaxFromTotal(gBank, inp.vatInclusive, rateNum);

  const netSales = roundAmount(nApp.plus(nCash).plus(nBank));
  const vatAmount = roundAmount(tApp.plus(tCash).plus(tBank));

  const appNetForComm = nApp;
  const baseComm = inp.commissionBase === 'gross' ? gApp : appNetForComm;
  const commission = inp.includeAppChannel
    ? roundAmount(baseComm.mul(inp.commissionPct).div(100))
    : new Decimal(0);

  const netProfit = roundAmount(netSales.minus(commission).minus(inp.fixedTotal));

  const appShareOfGrossPct = grossTotal.gt(0)
    ? roundAmount(gApp.div(grossTotal).mul(100), 2)
    : new Decimal(0);

  return {
    grossApp: gApp,
    grossLocalCash: gCash,
    grossLocalBank: gBank,
    grossLocal: gLocal,
    grossTotal,
    netSales,
    vatAmount,
    commission,
    fixedTotal: roundAmount(inp.fixedTotal),
    netProfit,
    appShareOfGrossPct,
  };
}

export type ReverseGrossTotalResult =
  | { ok: true; grossTotal: Decimal }
  | { ok: false; code: 'denom_non_positive' | 'invalid_share' };

/**
 * حجم إجمالي المبيعات (شامل/غير شامل حسب المدخل) المطلوب لتحقيق ربح مستهدف،
 * مع ثبات: نسبة التطبيقات من الإجمالي، نسبة كاش/بنك داخل المحلي، نسبة العمولة، الضريبة.
 */
export function reverseGrossTotalForTargetProfit(params: {
  targetProfit: Decimal;
  fixedTotal: Decimal;
  /** حصة التطبيقات من الإجمالي 0–1 */
  appShareDecimal: Decimal;
  vatInclusive: boolean;
  vatRate: Decimal;
  commissionPct: Decimal;
  commissionBase: CostAppsCommissionBase;
}): ReverseGrossTotalResult {
  const alpha = params.appShareDecimal;
  if (alpha.lt(0) || alpha.gt(1)) return { ok: false, code: 'invalid_share' };

  const P = d(params.targetProfit).plus(d(params.fixedTotal));
  const r = params.vatRate;
  const onePlusR = new Decimal(1).plus(r);
  const p = params.commissionPct.div(100);

  let denom: Decimal;
  if (params.vatInclusive) {
    if (params.commissionBase === 'gross') {
      denom = new Decimal(1).div(onePlusR).minus(alpha.mul(p));
    } else {
      denom = new Decimal(1).div(onePlusR).mul(new Decimal(1).minus(alpha.mul(p)));
    }
  } else if (params.commissionBase === 'gross') {
    denom = new Decimal(1).minus(alpha.mul(p));
  } else {
    denom = new Decimal(1).minus(alpha.mul(p));
  }

  if (!denom.isFinite() || denom.lte(0)) return { ok: false, code: 'denom_non_positive' };
  return { ok: true, grossTotal: roundAmount(P.div(denom), 2) };
}

/** تجميع من ملخصات dashboard-pack (قنوات يومية) */
export function aggregateSalesChannelsInRange(
  summaries: readonly any[],
  fromYmd: string,
  toYmd: string,
): { grossApp: Decimal; grossLocalCash: Decimal; grossLocalBank: Decimal; daysUsed: number } {
  let app = new Decimal(0);
  let cash = new Decimal(0);
  let bank = new Decimal(0);
  const from = String(fromYmd || '');
  const to = String(toYmd || '');
  let daysUsed = 0;

  for (const s of summaries || []) {
    const dStr =
      typeof s?.transactionDate === 'string'
        ? s.transactionDate.slice(0, 10)
        : (s?.transactionDate && new Date(s.transactionDate).toISOString().slice(0, 10)) || '';
    if (!dStr || dStr < from || dStr > to) continue;
    let touched = false;
    for (const ch of s.channels || []) {
      const amt = new Decimal(ch?.amount ?? 0);
      if (amt.lte(0)) continue;
      const typ = String(ch?.vault?.type || '');
      if (typ === 'app') {
        app = app.plus(amt);
        touched = true;
      } else if (typ === 'cash') {
        cash = cash.plus(amt);
        touched = true;
      } else if (typ === 'bank') {
        bank = bank.plus(amt);
        touched = true;
      }
    }
    if (touched) daysUsed += 1;
  }

  return { grossApp: app, grossLocalCash: cash, grossLocalBank: bank, daysUsed };
}

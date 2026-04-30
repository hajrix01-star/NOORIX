/**
 * نموذج معزول: ربح/خسارة تقديرية (تطبيقات × محلي × ضريبة × عمولة × تكلفة مبيعات).
 * جميع العمليات بـ Decimal.js.
 *
 * ## افتراضات محاسبية (مراجعة قبل تغيير السلوك)
 *
 * 1. **الضريبة:** `vatRate` كسر عشري (0.15 = 15%). عند «شامل الضريبة» يُستخرج الصافي والضريبة
 *    عبر `splitTaxFromTotal` (صافي = إجمالي ÷ (1+r)). عند عدم التضمين تُعامل المدخلات كصافية
 *    بلا استخراج ضريبة في هذا الجدول (ضريبة العرض = 0).
 * 2. **العمولة:** على مبيعات التطبيقات فقط؛ إما على **إجمالي** قناة التطبيق أو على **صافيها**
 *    بعد استخراج الضريبة حسب (1).
 * 3. **تكلفة المبيعات:** تُحسب كنسبة من **إجمالي المدخل لكل قناة كما أُدخل** (وليس من صافي المبيعات بعد الضريبة):
 *    محلي = (نقد+بنك)×نسبة؛ تطبيقات = إجمالي التطبيقات × النسبة ÷ (1+رفع السعر) لمكافئ المحل عند وجود «رفع سعر».
 * 4. **صافي الربح:** صافي المبيعات − عمولة − إجمالي COGS − مصاريف البنود (شهري) − رواتب (شهري) — في الواجهة تُعرض كجدول مصاريف واحد.
 * 5. **الحساب العكسي:** يفترض تجميع إجمالي المبيعات G مع حصة تطبيقات α من G ثابتة؛ يطابق (1)–(4) جبرياً.
 *    **معاينة من جملة معلومة:** بإدخال G وα يُشتق صافي الربح عبر `computeCostAppsPl` (بعد توزيع المحلي بنفس نسبة النقد/البنك الحالية إن وُجدت).
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
  /** إجمالي رواتب الفترة (شهري من المصدر) — يُطرح من صافي الربح */
  salaryTotal: Decimal;
  /** false = لا مبيعات تطبيقات ولا عمولة (مقارنة) */
  includeAppChannel: boolean;
  /** 0–100: تكلفة المبيعات كنسبة من إجمالي مبيعات المحلي (كاش+بنك) */
  cogsLocalPct: Decimal;
  /** 0–100: رفع سعر التطبيقات مقابل مكافئ المحل (+30 => ÷1.30 على إجمالي التطبيقات) */
  appPriceMarkupPct: Decimal;
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
  cogsLocal: Decimal;
  cogsApp: Decimal;
  cogsTotal: Decimal;
  fixedTotal: Decimal;
  salaryTotal: Decimal;
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

/** معامل تكلفة المبيعات الخطي في الإجمالي: COGS_total = coeff × G */
export function cogsCoefficientPerGrossTotal(
  cogsLocalPct: Decimal,
  appPriceMarkupPct: Decimal,
  alpha: Decimal,
): Decimal {
  const c = d(cogsLocalPct).div(100);
  if (c.lte(0)) return new Decimal(0);
  const m = d(appPriceMarkupPct).div(100);
  const onePlusM = new Decimal(1).plus(m);
  const divisor = onePlusM.gt(0) ? onePlusM : new Decimal(1);
  const a = d(alpha);
  const inner = new Decimal(1).minus(a).plus(a.div(divisor));
  return c.mul(inner);
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

  const cRate = d(inp.cogsLocalPct).div(100);
  const m = d(inp.appPriceMarkupPct).div(100);
  const onePlusM = new Decimal(1).plus(m);
  const divisor = onePlusM.gt(0) ? onePlusM : new Decimal(1);

  const cogsLocal = roundAmount(gLocal.mul(cRate));
  const cogsApp =
    inp.includeAppChannel && gApp.gt(0) && cRate.gt(0)
      ? roundAmount(gApp.mul(cRate).div(divisor))
      : new Decimal(0);
  const cogsTotal = roundAmount(cogsLocal.plus(cogsApp));

  const fixedRounded = roundAmount(d(inp.fixedTotal));
  const salary = roundAmount(d(inp.salaryTotal));
  const netProfit = roundAmount(
    netSales.minus(commission).minus(cogsTotal).minus(fixedRounded).minus(salary),
  );

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
    cogsLocal,
    cogsApp,
    cogsTotal,
    fixedTotal: fixedRounded,
    salaryTotal: salary,
    netProfit,
    appShareOfGrossPct,
  };
}

export type ReverseGrossTotalResult =
  | { ok: true; grossTotal: Decimal }
  | { ok: false; code: 'denom_non_positive' | 'invalid_share' };

/**
 * حجم إجمالي المبيعات (شامل/غير شامل حسب المدخل) المطلوب لتحقيق ربح مستهدف،
 * مع ثبات: حصة التطبيقات من الإجمالي α، عمولة، ضريبة، وتكلفة مبيعات (محلي + تطبيقات بمكافئ المحل).
 */
export function reverseGrossTotalForTargetProfit(params: {
  targetProfit: Decimal;
  fixedTotal: Decimal;
  /** رواتب الفترة (تُضاف إلى التكاليف الثابتة في الحل العكسي) */
  salaryTotal?: Decimal;
  /** حصة التطبيقات من الإجمالي 0–1 */
  appShareDecimal: Decimal;
  vatInclusive: boolean;
  vatRate: Decimal;
  commissionPct: Decimal;
  commissionBase: CostAppsCommissionBase;
  cogsLocalPct?: Decimal;
  appPriceMarkupPct?: Decimal;
}): ReverseGrossTotalResult {
  const alpha = params.appShareDecimal;
  if (alpha.lt(0) || alpha.gt(1)) return { ok: false, code: 'invalid_share' };

  const P = d(params.targetProfit).plus(d(params.fixedTotal)).plus(d(params.salaryTotal ?? 0));
  const r = params.vatRate;
  const onePlusR = new Decimal(1).plus(r);
  const p = params.commissionPct.div(100);

  const kCogs = cogsCoefficientPerGrossTotal(
    d(params.cogsLocalPct ?? 0),
    d(params.appPriceMarkupPct ?? 0),
    alpha,
  );

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

  denom = denom.minus(kCogs);

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

import { BadRequestException } from '@nestjs/common';

/** Ratio bands: higher ratio → worse; warning before critical. */
export type PurchaseExpenseThresholdBand = {
  warning: number;
  critical: number;
};

/** Net profit margin (decimal): warn when below warningBelow; critical when below criticalBelow. */
export type NetProfitMarginThresholdBand = {
  warningBelow: number;
  criticalBelow: number;
};

/** Full payload merged from generic defaults + optional DB overrides (Phase A — storage shape). */
export type CompanyInsightThresholdsPayload = {
  purchaseToSales: PurchaseExpenseThresholdBand;
  expenseToSales: PurchaseExpenseThresholdBand;
  netProfitMargin: NetProfitMarginThresholdBand;
};

export type CompanyInsightThresholdsPartialOverride = Partial<{
  purchaseToSales: Partial<PurchaseExpenseThresholdBand>;
  expenseToSales: Partial<PurchaseExpenseThresholdBand>;
  netProfitMargin: Partial<NetProfitMarginThresholdBand>;
}>;

/** Built-in defaults aligned with current global `INSIGHT_THRESHOLDS` ratios / margin floor. */
export const DEFAULT_GENERIC_INSIGHT_THRESHOLDS: Readonly<CompanyInsightThresholdsPayload> = Object.freeze({
  purchaseToSales: Object.freeze({ warning: 0.65, critical: 0.8 }),
  expenseToSales: Object.freeze({ warning: 0.35, critical: 0.5 }),
  netProfitMargin: Object.freeze({ warningBelow: 0.05, criticalBelow: 0 }),
});

/** Preset for high-COGS operations (e.g. restaurants) — not persisted until API chooses it. */
export const DEFAULT_RESTAURANT_INSIGHT_THRESHOLDS: Readonly<CompanyInsightThresholdsPayload> = Object.freeze({
  purchaseToSales: Object.freeze({ warning: 0.35, critical: 0.45 }),
  expenseToSales: Object.freeze({ warning: 0.4, critical: 0.55 }),
  netProfitMargin: Object.freeze({ warningBelow: 0.1, criticalBelow: 0 }),
});

function cloneGenericDefaults(): CompanyInsightThresholdsPayload {
  return {
    purchaseToSales: {
      warning: DEFAULT_GENERIC_INSIGHT_THRESHOLDS.purchaseToSales.warning,
      critical: DEFAULT_GENERIC_INSIGHT_THRESHOLDS.purchaseToSales.critical,
    },
    expenseToSales: {
      warning: DEFAULT_GENERIC_INSIGHT_THRESHOLDS.expenseToSales.warning,
      critical: DEFAULT_GENERIC_INSIGHT_THRESHOLDS.expenseToSales.critical,
    },
    netProfitMargin: {
      warningBelow: DEFAULT_GENERIC_INSIGHT_THRESHOLDS.netProfitMargin.warningBelow,
      criticalBelow: DEFAULT_GENERIC_INSIGHT_THRESHOLDS.netProfitMargin.criticalBelow,
    },
  };
}

/**
 * Deep-merge partial overrides onto generic defaults. Does not mutate default constants.
 */
export function mergeInsightThresholds(
  overrides: CompanyInsightThresholdsPartialOverride | null | undefined,
): CompanyInsightThresholdsPayload {
  const out = cloneGenericDefaults();
  if (!overrides) return out;

  const ps = overrides.purchaseToSales;
  if (ps) {
    if (ps.warning !== undefined) out.purchaseToSales.warning = ps.warning;
    if (ps.critical !== undefined) out.purchaseToSales.critical = ps.critical;
  }
  const es = overrides.expenseToSales;
  if (es) {
    if (es.warning !== undefined) out.expenseToSales.warning = es.warning;
    if (es.critical !== undefined) out.expenseToSales.critical = es.critical;
  }
  const nm = overrides.netProfitMargin;
  if (nm) {
    if (nm.warningBelow !== undefined) out.netProfitMargin.warningBelow = nm.warningBelow;
    if (nm.criticalBelow !== undefined) out.netProfitMargin.criticalBelow = nm.criticalBelow;
  }
  return out;
}

function assertFinite(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException(`${name} must be a finite number`);
  }
}

function assertRatioBand(label: string, warning: number, critical: number): void {
  assertFinite(`${label}.warning`, warning);
  assertFinite(`${label}.critical`, critical);
  const lo = 0;
  const hi = 1;
  if (warning < lo || warning > hi || critical < lo || critical > hi) {
    throw new BadRequestException(`${label}: warning and critical must be between ${lo} and ${hi}`);
  }
  if (!(warning < critical)) {
    throw new BadRequestException(`${label}: warning must be strictly less than critical`);
  }
}

function assertNetProfitMarginBand(warningBelow: number, criticalBelow: number): void {
  assertFinite('netProfitMargin.warningBelow', warningBelow);
  assertFinite('netProfitMargin.criticalBelow', criticalBelow);
  const lo = 0;
  const hi = 1;
  if (warningBelow < lo || warningBelow > hi || criticalBelow < lo || criticalBelow > hi) {
    throw new BadRequestException(`netProfitMargin: warningBelow and criticalBelow must be between ${lo} and ${hi}`);
  }
  if (!(criticalBelow <= warningBelow)) {
    throw new BadRequestException('netProfitMargin: criticalBelow must be less than or equal to warningBelow');
  }
}

/**
 * Validates a complete thresholds object (e.g. after merge). Throws {@link BadRequestException} on failure.
 */
export function validateInsightThresholds(thresholds: CompanyInsightThresholdsPayload): void {
  assertRatioBand(
    'purchaseToSales',
    thresholds.purchaseToSales.warning,
    thresholds.purchaseToSales.critical,
  );
  assertRatioBand(
    'expenseToSales',
    thresholds.expenseToSales.warning,
    thresholds.expenseToSales.critical,
  );
  assertNetProfitMarginBand(
    thresholds.netProfitMargin.warningBelow,
    thresholds.netProfitMargin.criticalBelow,
  );
}

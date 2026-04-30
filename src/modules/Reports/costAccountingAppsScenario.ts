/**
 * ملف سيناريو حاسبة التكاليف/التطبيقات — تصدير/استيراد JSON (معزول عن الخادم).
 */

export const COST_APPS_SCENARIO_VERSION = 1 as const;

export type CostAppsScenarioFixedLine = { id: string; label: string; amount: string };

export type CostAppsScenarioFile = {
  version: typeof COST_APPS_SCENARIO_VERSION;
  /** ISO-8601 */
  exportedAt?: string;
  /** اسم اختياري للسيناريو */
  name?: string;
  grossAppStr?: string;
  grossCashStr?: string;
  grossBankStr?: string;
  vatInclusive?: boolean;
  vatRatePctStr?: string;
  commissionPctStr?: string;
  commissionBase?: 'gross' | 'net';
  fixedLines?: CostAppsScenarioFixedLine[];
  /** إجمالي رواتب الفترة (نص) */
  salaryStr?: string;
  importFrom?: string;
  importTo?: string;
  targetProfitStr?: string;
  reverseGrossStr?: string;
  appSharePctStr?: string;
  reverseAppSharePctStr?: string;
  cogsLocalPctStr?: string;
  appPriceMarkupPctStr?: string;
  /** إجمالي مبيعات للمعاينة العكسية (ربح من جملة معلومة) */
  probeSalesGrossStr?: string;
};

export type CostAppsScenarioRestore = {
  grossAppStr?: string;
  grossCashStr?: string;
  grossBankStr?: string;
  vatInclusive?: boolean;
  vatRatePctStr?: string;
  commissionPctStr?: string;
  commissionBase?: 'gross' | 'net';
  fixedLines?: CostAppsScenarioFixedLine[];
  /** إجمالي رواتب الفترة (نص) */
  salaryStr?: string;
  importFrom?: string;
  importTo?: string;
  targetProfitStr?: string;
  reverseGrossStr?: string;
  appSharePctStr?: string;
  reverseAppSharePctStr?: string;
  cogsLocalPctStr?: string;
  appPriceMarkupPctStr?: string;
  probeSalesGrossStr?: string;
};

function newLineId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeFixedLines(raw: unknown): CostAppsScenarioFixedLine[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CostAppsScenarioFixedLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    out.push({
      id: typeof o.id === 'string' && o.id ? String(o.id) : newLineId(),
      label: o.label != null ? String(o.label) : '',
      amount: o.amount != null ? String(o.amount) : '',
    });
  }
  return out.length ? out : undefined;
}

/**
 * يقرأ JSON ملف سيناريو ويُرجع حقولاً آمنة للتطبيق على الحالة.
 */
export function parseCostAppsScenarioJson(
  text: string,
): { ok: true; restore: CostAppsScenarioRestore } | { ok: false; error: string } {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'not_object' };
  const rec = obj as Record<string, unknown>;
  const ver = rec.version;
  if (ver !== COST_APPS_SCENARIO_VERSION) return { ok: false, error: 'bad_version' };

  const restore: CostAppsScenarioRestore = {};
  if (rec.grossAppStr != null) restore.grossAppStr = String(rec.grossAppStr);
  if (rec.grossCashStr != null) restore.grossCashStr = String(rec.grossCashStr);
  if (rec.grossBankStr != null) restore.grossBankStr = String(rec.grossBankStr);
  if (typeof rec.vatInclusive === 'boolean') restore.vatInclusive = rec.vatInclusive;
  if (rec.vatRatePctStr != null) restore.vatRatePctStr = String(rec.vatRatePctStr);
  if (rec.commissionPctStr != null) restore.commissionPctStr = String(rec.commissionPctStr);
  if (rec.commissionBase === 'gross' || rec.commissionBase === 'net') restore.commissionBase = rec.commissionBase;
  const fl = normalizeFixedLines(rec.fixedLines);
  if (fl) restore.fixedLines = fl;
  if (rec.salaryStr != null) restore.salaryStr = String(rec.salaryStr);
  if (rec.importFrom != null) restore.importFrom = String(rec.importFrom);
  if (rec.importTo != null) restore.importTo = String(rec.importTo);
  if (rec.targetProfitStr != null) restore.targetProfitStr = String(rec.targetProfitStr);
  if (rec.reverseGrossStr != null) restore.reverseGrossStr = String(rec.reverseGrossStr);
  if (rec.appSharePctStr != null) restore.appSharePctStr = String(rec.appSharePctStr);
  if (rec.reverseAppSharePctStr != null) restore.reverseAppSharePctStr = String(rec.reverseAppSharePctStr);
  if (rec.cogsLocalPctStr != null) restore.cogsLocalPctStr = String(rec.cogsLocalPctStr);
  if (rec.appPriceMarkupPctStr != null) restore.appPriceMarkupPctStr = String(rec.appPriceMarkupPctStr);
  if (rec.probeSalesGrossStr != null) restore.probeSalesGrossStr = String(rec.probeSalesGrossStr);

  if (Object.keys(restore).length === 0) return { ok: false, error: 'empty_scenario' };

  return { ok: true, restore };
}

export function buildCostAppsScenarioFile(
  fields: Omit<CostAppsScenarioFile, 'version' | 'exportedAt'>,
): string {
  const body: CostAppsScenarioFile = {
    version: COST_APPS_SCENARIO_VERSION,
    exportedAt: new Date().toISOString(),
    ...fields,
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

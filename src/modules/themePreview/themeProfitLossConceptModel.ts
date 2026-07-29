export type PeriodMode = 'month' | 'quarter' | 'half' | 'year';
export type DetailLevel = 1 | 2 | 3;
export type RowKind = 'line' | 'subtotal' | 'result';

export type PlRow = {
  id: string;
  labelAr: string;
  labelEn: string;
  level: DetailLevel;
  kind: RowKind;
  current: number;
  previous: number;
  noteAr?: string;
  noteEn?: string;
};

export type DateFilterComparableState = {
  monthRangeStartYear: number;
  monthRangeStartMonth: number;
  monthRangeEndYear: number;
  monthRangeEndMonth: number;
};

export const profitLossMonths: { key: string; labelAr: string; labelEn: string; factor: number }[] = [
  { key: 'jan', labelAr: 'يناير', labelEn: 'Jan', factor: 0.82 },
  { key: 'feb', labelAr: 'فبراير', labelEn: 'Feb', factor: 0.86 },
  { key: 'mar', labelAr: 'مارس', labelEn: 'Mar', factor: 0.91 },
  { key: 'apr', labelAr: 'أبريل', labelEn: 'Apr', factor: 0.95 },
  { key: 'may', labelAr: 'مايو', labelEn: 'May', factor: 1.01 },
  { key: 'jun', labelAr: 'يونيو', labelEn: 'Jun', factor: 1.04 },
  { key: 'jul', labelAr: 'يوليو', labelEn: 'Jul', factor: 1 },
  { key: 'aug', labelAr: 'أغسطس', labelEn: 'Aug', factor: 1.03 },
  { key: 'sep', labelAr: 'سبتمبر', labelEn: 'Sep', factor: 1.06 },
  { key: 'oct', labelAr: 'أكتوبر', labelEn: 'Oct', factor: 1.1 },
  { key: 'nov', labelAr: 'نوفمبر', labelEn: 'Nov', factor: 1.14 },
  { key: 'dec', labelAr: 'ديسمبر', labelEn: 'Dec', factor: 1.18 },
];

export const profitLossPeriodMeta: Record<PeriodMode, { subAr: string; subEn: string; factor: number }> = {
  month: { subAr: 'شهر واحد', subEn: 'One month', factor: 1 },
  quarter: { subAr: '3 أشهر', subEn: '3 months', factor: 3.05 },
  half: { subAr: '6 أشهر', subEn: '6 months', factor: 6.1 },
  year: { subAr: 'سنة كاملة', subEn: 'Full year', factor: 12.2 },
};

export const profitLossLevelOptions: { id: DetailLevel; labelAr: string; labelEn: string }[] = [
  { id: 1, labelAr: 'المستوى 1', labelEn: 'Level 1' },
  { id: 2, labelAr: 'المستوى 2', labelEn: 'Level 2' },
  { id: 3, labelAr: 'المستوى 3', labelEn: 'Level 3' },
];

export const profitLossRows: PlRow[] = [
  { id: 'revenue', labelAr: 'الإيرادات', labelEn: 'Revenue', level: 1, kind: 'line', current: 186000, previous: 171000 },
  { id: 'store-sales', labelAr: 'مبيعات الفروع', labelEn: 'Store sales', level: 2, kind: 'line', current: 128500, previous: 119200 },
  { id: 'delivery-sales', labelAr: 'مبيعات التوصيل', labelEn: 'Delivery sales', level: 2, kind: 'line', current: 42100, previous: 37200 },
  { id: 'other-revenue', labelAr: 'دخل تشغيلي آخر', labelEn: 'Other operating income', level: 2, kind: 'line', current: 15400, previous: 14600 },
  { id: 'olaya', labelAr: 'فرع العليا', labelEn: 'Olaya branch', level: 3, kind: 'line', current: 52300, previous: 48900 },
  { id: 'rawdah', labelAr: 'فرع الروضة', labelEn: 'Rawdah branch', level: 3, kind: 'line', current: 40700, previous: 38100 },
  { id: 'apps', labelAr: 'تطبيقات التوصيل', labelEn: 'Delivery apps', level: 3, kind: 'line', current: 32500, previous: 28400 },
  { id: 'cost', labelAr: 'تكاليف الإيرادات', labelEn: 'Cost of revenue', level: 1, kind: 'line', current: -74400, previous: -70300 },
  { id: 'food', labelAr: 'مواد غذائية', labelEn: 'Food materials', level: 2, kind: 'line', current: -51200, previous: -48600 },
  { id: 'packaging', labelAr: 'تغليف وتشغيل', labelEn: 'Packaging and operations', level: 2, kind: 'line', current: -14300, previous: -13200 },
  { id: 'waste', labelAr: 'هدر وتسويات تكلفة', labelEn: 'Waste and cost adjustments', level: 2, kind: 'line', current: -8900, previous: -8500 },
  { id: 'protein', labelAr: 'لحوم وبروتين', labelEn: 'Meat and protein', level: 3, kind: 'line', current: -21600, previous: -20400 },
  { id: 'produce', labelAr: 'خضار ومكونات', labelEn: 'Produce and ingredients', level: 3, kind: 'line', current: -17800, previous: -16900 },
  { id: 'boxes', labelAr: 'علب وأكياس', labelEn: 'Boxes and bags', level: 3, kind: 'line', current: -9100, previous: -8400 },
  { id: 'gross', labelAr: 'إجمالي الربح', labelEn: 'Gross profit', level: 1, kind: 'subtotal', current: 111600, previous: 100700 },
  { id: 'operating-expenses', labelAr: 'نفقات التشغيل', labelEn: 'Operating expenses', level: 1, kind: 'line', current: -49200, previous: -46800 },
  { id: 'payroll', labelAr: 'رواتب ومزايا', labelEn: 'Payroll and benefits', level: 2, kind: 'line', current: -25800, previous: -25100 },
  { id: 'rent', labelAr: 'إيجارات وخدمات', labelEn: 'Rent and utilities', level: 2, kind: 'line', current: -13600, previous: -13200 },
  { id: 'marketing', labelAr: 'تسويق وعمولات', labelEn: 'Marketing and commissions', level: 2, kind: 'line', current: -9800, previous: -8500 },
  { id: 'base-salaries', labelAr: 'رواتب أساسية', labelEn: 'Base salaries', level: 3, kind: 'line', current: -19300, previous: -18800 },
  { id: 'utilities', labelAr: 'كهرباء ومياه', labelEn: 'Electricity and water', level: 3, kind: 'line', current: -6100, previous: -5700 },
  { id: 'campaigns', labelAr: 'حملات محلية', labelEn: 'Local campaigns', level: 3, kind: 'line', current: -5600, previous: -4600 },
  { id: 'operating-income', labelAr: 'الدخل التشغيلي (أو الخسائر التشغيلية)', labelEn: 'Operating income (loss)', level: 1, kind: 'subtotal', current: 62400, previous: 53900 },
  { id: 'other-income', labelAr: 'دخل آخر', labelEn: 'Other income', level: 1, kind: 'line', current: 8200, previous: 6400 },
  { id: 'other-expense', labelAr: 'النفقات الأخرى', labelEn: 'Other expenses', level: 1, kind: 'line', current: -5100, previous: -4800 },
  { id: 'finance-income', labelAr: 'عوائد بنكية', labelEn: 'Bank returns', level: 3, kind: 'line', current: 2200, previous: 1800 },
  { id: 'finance-fees', labelAr: 'رسوم تمويلية', labelEn: 'Finance fees', level: 3, kind: 'line', current: -1700, previous: -1600 },
  { id: 'net', labelAr: 'صافي الربح', labelEn: 'Net profit', level: 1, kind: 'subtotal', current: 65500, previous: 55500 },
  { id: 'provisions', labelAr: 'التخصيصات والمسحوبات', labelEn: 'Provisions and withdrawals', level: 1, kind: 'line', current: -9500, previous: -8200 },
  { id: 'owner-withdrawals', labelAr: 'مسحوبات المالك', labelEn: 'Owner withdrawals', level: 3, kind: 'line', current: -6200, previous: -5600 },
  { id: 'reserve', labelAr: 'احتياطي تشغيلي', labelEn: 'Operating reserve', level: 3, kind: 'line', current: -3300, previous: -2600 },
  { id: 'retained', labelAr: 'صافي الربح المتبقي بعد المخصصات والمسحوبات', labelEn: 'Retained profit after provisions and withdrawals', level: 1, kind: 'result', current: 56000, previous: 47300 },
];

export function scaleProfitLossValue(value: number, factor: number) {
  return Math.round(value * factor);
}

export function monthSpanCount(startYear: number, startMonth: number, endYear: number, endMonth: number) {
  const start = startYear * 12 + startMonth;
  const end = endYear * 12 + endMonth;
  return Math.abs(end - start) + 1;
}

export function periodModeFromFilter(mode: string, state: DateFilterComparableState): PeriodMode {
  if (mode === 'year') return 'year';
  if (mode === 'quarter') return 'quarter';
  if (mode === 'months') {
    const count = monthSpanCount(
      state.monthRangeStartYear,
      state.monthRangeStartMonth,
      state.monthRangeEndYear,
      state.monthRangeEndMonth,
    );
    if (count >= 10) return 'year';
    if (count >= 5) return 'half';
    if (count >= 2) return 'quarter';
  }
  return 'month';
}

export function periodFactorFromFilter(mode: string, state: DateFilterComparableState) {
  return profitLossPeriodMeta[periodModeFromFilter(mode, state)].factor;
}

export function profitLossMonthValue(row: PlRow, monthFactor: number) {
  return Math.round(row.current * monthFactor);
}

export function profitLossYearTotal(row: PlRow) {
  return profitLossMonths.reduce((total, month) => total + profitLossMonthValue(row, month.factor), 0);
}

export function formatProfitLossMoney(value: number) {
  const sign = value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function profitLossPercent(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatProfitLossPercent(value: number | null, isArabic: boolean) {
  if (value == null || !Number.isFinite(value)) return isArabic ? 'غير منطقي' : 'N/A';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function profitLossRowClass(kind: RowKind) {
  if (kind === 'result') return 'bg-slate-300/80 font-black';
  if (kind === 'subtotal') return 'bg-slate-200/90 font-black';
  return 'bg-white';
}

export function profitLossNumberClass(_value: number, kind: RowKind) {
  if (kind !== 'line') return 'text-slate-700';
  return 'text-slate-700';
}

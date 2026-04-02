/**
 * تقييد نطاق استعلام ملخصات المبيعات إلى آخر N يوماً تقويمياً (توقيت السعودية)، شاملاً يوم النهاية.
 * يُستخدم مع مستخدمين لا يملكون SALES_FULL_HISTORY.
 */
function saudiTodayYmd(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const m = parts.reduce<Record<string, string>>((a, p) => {
    if (p.type !== 'literal') a[p.type] = p.value;
    return a;
  }, {});
  return `${m.year}-${m.month}-${m.day}`;
}

function sliceYmd(s?: string): string | undefined {
  if (!s) return undefined;
  const t = String(s).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : undefined;
}

function minYmd(a: string, b: string): string {
  return a <= b ? a : b;
}
function maxYmd(a: string, b: string): string {
  return a >= b ? a : b;
}

/** إضافة أيام إلى YYYY-MM-DD (تقويم بسيط UTC) */
function addDaysYmd(ymd: string, delta: number): string {
  const [y, mo, d] = ymd.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, mo - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

export function clampSalesSummaryDateQuery(
  startDate?: string,
  endDate?: string,
  inclusiveDays = 7,
): { startDate: string; endDate: string } {
  const today = saudiTodayYmd();
  const reqEnd = sliceYmd(endDate) ?? today;
  const end = minYmd(reqEnd, today);
  const earliest = addDaysYmd(end, -(inclusiveDays - 1));
  const reqStart = sliceYmd(startDate) ?? earliest;
  const start = maxYmd(reqStart, earliest);
  const [s, e] = start <= end ? [start, end] : [end, start];
  return { startDate: s, endDate: e };
}

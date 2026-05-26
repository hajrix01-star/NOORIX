import Decimal from 'decimal.js';

/** نسبة العمولة في عنوان عمود السيناريو (المدخل 0–100 كما في النموذج). */
export function formatCommissionPctForColumnLabel(d: Decimal): string {
  const n = d.toNumber();
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  let s = rounded.toFixed(2);
  s = s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return s;
}

export type FixedLine = { id: string; label: string; amount: string };

export function ymdParts(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function lastDayOfMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

export function formatYearMonthLabel(year: number, month: number, lang: string): string {
  const iso = `${year}-${String(month).padStart(2, '0')}-15T12:00:00+03:00`;
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Riyadh',
    }).format(new Date(iso));
  } catch {
    return `${year}-${String(month).padStart(2, '0')}`;
  }
}

/** يطابق مفتاح YYYY-MM إذا كان من–إلى يغطيان الشهر كاملاً */
export function importMonthKeyFromRange(from: string, to: string): string | null {
  if (!from || !to || from.length < 10 || to.length < 10) return null;
  const y = parseInt(from.slice(0, 4), 10);
  const m = parseInt(from.slice(5, 7), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  if (from !== ymdParts(y, m, 1)) return null;
  if (to !== ymdParts(y, m, lastDayOfMonth(y, m))) return null;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function parseMoneyInput(s: string): Decimal {
  const n = String(s || '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  if (!n) return new Decimal(0);
  try {
    return new Decimal(n);
  } catch {
    return new Decimal(0);
  }
}

export function newLine(): FixedLine {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label: '', amount: '' };
}

export function normalizeFixedLines(raw: unknown): FixedLine[] {
  if (!Array.isArray(raw) || raw.length === 0) return [newLine()];
  const rows: FixedLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const x = item as Record<string, unknown>;
    rows.push({
      id: typeof x.id === 'string' && x.id ? x.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: x.label != null ? String(x.label) : '',
      amount: x.amount != null ? String(x.amount) : '',
    });
  }
  return rows.length ? rows : [newLine()];
}

export function draftKey(companyId: string) {
  return `noorix-cost-apps-draft-v1:${companyId}`;
}

function mapCsvAmount(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function parseCsvForCostApps(text: string): { app: string; cash: string; bank: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length);
  if (!lines.length) return { app: '', cash: '', bank: '' };
  const splitRow = (line: string) => line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
  if (lines.length === 1) {
    const cells = splitRow(lines[0]);
    const nums = cells.filter((c) => /^-?\d/.test(c.replace(/,/g, '')));
    if (cells.length >= 3 && nums.length >= 3) {
      return { app: cells[0], cash: cells[1], bank: cells[2] };
    }
  }
  const headers = splitRow(lines[0]).map((h) => h.toLowerCase());
  const valueRow = lines.length >= 2 ? splitRow(lines[1]) : splitRow(lines[0]);
  const row: Record<string, string> = {};
  headers.forEach((h, i) => {
    row[h] = valueRow[i] ?? '';
  });
  return {
    app: mapCsvAmount(row, ['app', 'تطبيق', 'apps']),
    cash: mapCsvAmount(row, ['cash', 'نقد', 'كاش']),
    bank: mapCsvAmount(row, ['bank', 'بنك', 'مدى', 'mada']),
  };
}

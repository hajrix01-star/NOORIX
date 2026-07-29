import { formatSaudiDateISO } from '../saudiDate';

/** @param {Date} d */
export function toRiyadhYmdOrNull(d: Date) {
  if (!d || isNaN(d.getTime())) return null;
  const y = formatSaudiDateISO(d);
  return y === '—' ? null : y;
}

// ─── Low-level helpers ───────────────────────────────────────────────────────

const AR_NUMS = '٠١٢٣٤٥٦٧٨٩';
export type ImportRow = Record<string, unknown>;
export type LookupItem = Record<string, unknown>;
export type ValidationResult = {
  rowNum: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  payload: Record<string, unknown> | null;
};
export type EmployeeExportSalaryRow = Record<string, unknown>;

export function toWesternNum(str: unknown) {
  if (str == null) return '';
  return String(str).replace(/[٠-٩]/g, (c) => AR_NUMS.indexOf(c).toString());
}

/** Parse an Excel date cell (serial number, string DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY) → 'YYYY-MM-DD' | null */
export function parseDate(val: unknown) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return toRiyadhYmdOrNull(d);
  }
  const str = toWesternNum(String(val).trim());
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const dmy2 = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy2) return `${dmy2[3]}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`;
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  const d = new Date(str);
  return toRiyadhYmdOrNull(d);
}

/** Parse boolean from Arabic/English/numeric values → true | false | null (unrecognised) */
export function parseBoolean(val: unknown) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  const s = String(val ?? '').trim().toLowerCase();
  if (['نعم', 'yes', 'true', '1', 'صح', 'y'].includes(s)) return true;
  if (['لا', 'no', 'false', '0', 'خطأ', 'n'].includes(s)) return false;
  return null;
}

/** Parse a numeric cell; strips commas, Arabic numerals → number | null */
export function parseNumber(val: unknown) {
  if (val == null || val === '') return null;
  const s = toWesternNum(String(val).replace(/,/g, '').replace(/\s/g, '').trim());
  const n = Number(s);
  return isNaN(n) ? null : n;
}

/** Find an item in a list by nameAr or nameEn (case-insensitive) */
export function matchByName(
  list: unknown[],
  name: unknown,
  nameArKey: string = 'nameAr',
  nameEnKey: string = 'nameEn',
): LookupItem | null {
  if (!name) return null;
  const needle = String(name).trim().toLowerCase();
  const hit = list.find((item) => {
    const row = item as LookupItem;
    return (
      String(row[nameArKey] ?? '').trim().toLowerCase() === needle ||
      String(row[nameEnKey] ?? '').trim().toLowerCase() === needle
    );
  }) as LookupItem | undefined;
  return hit ?? null;
}

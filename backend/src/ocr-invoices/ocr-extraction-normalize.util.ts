import { toYmd } from '../common/utils/to-ymd.util';

const ARABIC_DIGITS_RE = /[٠-٩]/g;
const EASTERN_ARABIC_DIGITS_RE = /[۰-۹]/g;
const ARABIC_DECIMAL_SEPARATOR = /٫/g;
const ARABIC_THOUSANDS_SEPARATOR = /٬/g;
const NON_NUMBER_CHARS_RE = /[^0-9,.\-]/g;
const DATE_SEPARATOR_RE = /[\/.\-]/;
const VAT_DIGITS_RE = /[^0-9]/g;

function convertDigitsToWestern(value: string): string {
  return value
    .replace(ARABIC_DIGITS_RE, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_DIGITS_RE, (d) => String(d.charCodeAt(0) - 0x06F0));
}

function normalizeNumberSeparators(value: string): string {
  return value
    .replace(ARABIC_DECIMAL_SEPARATOR, '.')
    .replace(ARABIC_THOUSANDS_SEPARATOR, ',');
}

function normalizeRawString(value: unknown): string {
  if (value == null) return '';
  return normalizeNumberSeparators(convertDigitsToWestern(String(value))).trim();
}

function parseNumberWithSeparators(rawInput: string): number | undefined {
  if (!rawInput) return undefined;
  let cleaned = rawInput.replace(NON_NUMBER_CHARS_RE, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') return undefined;

  const commaCount = (cleaned.match(/,/g) || []).length;
  const dotCount = (cleaned.match(/\./g) || []).length;

  // إذا وُجدت الفاصلتان، نعتبر آخر رمز هو الفاصل العشري ونحذف الباقي كـ thousands.
  if (commaCount > 0 && dotCount > 0) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    cleaned = cleaned.split(thousandsSep).join('');
    if (decimalSep === ',') cleaned = cleaned.replace(',', '.');
  } else if (commaCount > 0 && dotCount === 0) {
    if (commaCount > 1) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      const [lhs, rhs = ''] = cleaned.split(',');
      cleaned = rhs.length <= 2 ? `${lhs}.${rhs}` : `${lhs}${rhs}`;
    }
  } else if (dotCount > 1) {
    const parts = cleaned.split('.');
    const decimal = parts.pop() || '';
    cleaned = `${parts.join('')}.${decimal}`;
  }

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

function toSafeYmd(year: number, month: number, day: number): string | undefined {
  if (!isValidYmd(year, month, day)) return undefined;
  return toYmd(new Date(Date.UTC(year, month - 1, day)));
}

function parseDateParts(raw: string): string | undefined {
  const normalized = normalizeRawString(raw);
  if (!normalized) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  if (/^\d{8}$/.test(normalized)) {
    const year = Number(normalized.slice(0, 4));
    const month = Number(normalized.slice(4, 6));
    const day = Number(normalized.slice(6, 8));
    return toSafeYmd(year, month, day);
  }

  const parts = normalized.split(DATE_SEPARATOR_RE).filter(Boolean);
  if (parts.length !== 3) return undefined;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n))) return undefined;

  // yyyy/mm/dd
  if (parts[0].length === 4) {
    return toSafeYmd(nums[0], nums[1], nums[2]);
  }

  // dd/mm/yyyy (أو dd/mm/yy)
  const year = parts[2].length === 2 ? 2000 + nums[2] : nums[2];
  return toSafeYmd(year, nums[1], nums[0]);
}

export function parseOcrNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return parseNumberWithSeparators(normalizeRawString(value));
}

export function parseOcrConfidence(value: unknown): number | undefined {
  const n = parseOcrNumber(value);
  if (n == null) return undefined;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function normalizeOcrDigits(value: unknown): string | undefined {
  const raw = normalizeRawString(value);
  if (!raw) return undefined;
  const digitsOnly = raw.replace(VAT_DIGITS_RE, '');
  return digitsOnly || undefined;
}

export function normalizeOcrDateToYmd(value: unknown): string | undefined {
  if (value == null) return undefined;
  const ymd = parseDateParts(String(value));
  return ymd || undefined;
}

export function normalizeOcrInvoiceNumber(value: unknown): string | undefined {
  if (value == null) return undefined;
  const normalized = normalizeRawString(value);
  if (!normalized) return undefined;
  return normalized.replace(/\s+/g, ' ');
}

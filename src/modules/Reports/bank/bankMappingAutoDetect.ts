import { formatSaudiDateISO } from '../../../utils/saudiDate';

export type BankSheetCell = string | number | Date | null | undefined;
export type BankSheetRow = readonly BankSheetCell[];
export type BankSheetData = readonly BankSheetRow[];
export type BankDetectedRows = {
  headerRow: number;
  dataStartRow: number;
  bankName: string;
  customerName: string;
  periodFrom: string;
  periodTo: string;
};
export type BankColumnKey = 'date' | 'description' | 'debit' | 'credit' | 'balance' | 'reference' | 'notes';
export type BankColumnMapping = Partial<Record<BankColumnKey, number>>;

const BANK_NAME_BLACKLIST = [
  'كشف الحساب',
  'كشف حساب',
  'بيان الحساب',
  'بيان حساب',
  'تقرير الحساب',
  'تقرير حساب',
  'account statement',
  'bank statement',
  'statement of account',
  'monthly statement',
  'كشف',
  'حساب',
  'statement',
  'تقرير',
  'تفاصيل الحساب',
];

const HEADER_KEYWORDS = [
  'تاريخ',
  'date',
  'وصف',
  'description',
  'مدين',
  'debit',
  'دائن',
  'credit',
  'رصيد',
  'balance',
  'بيان',
];

const BANK_KEYWORDS = [
  'الراجحي',
  'الأهلي',
  'الأهلي التجاري',
  'الإنماء',
  'الرياض',
  'البلاد',
  'ساب',
  'الجزيرة',
  'الفرنسي',
  'العربي',
  'البنك السعودي',
  'سامبا',
  'stc pay',
  'stcpay',
  'rajhi',
  'ahli',
  'inma',
  'riyad',
  'bilad',
  'sabb',
  'stc',
  'jazira',
  'fransi',
  'samba',
  'alinma',
  'alawwal',
  'الأول',
  'اليمامة',
];

const BANK_LABEL_KEYWORDS = ['اسم البنك', 'البنك', 'bank name', 'bank', 'جهة الإصدار', 'المصرف'];
const CUSTOMER_NAME_KEYWORDS = [
  'اسم العميل',
  'customer name',
  'account holder',
  'اسم صاحب الحساب',
  'صاحب الحساب',
  'account name',
  'client name',
];

const DATE_KEYWORDS = ['تاريخ', 'date', 'التاريخ', 'تاريخ العملية', 'transaction date', 'تاريخ القيد'];
const DESC_KEYWORDS = ['وصف', 'بيان', 'description', 'الوصف', 'البيان', 'تفاصيل', 'details'];
const DEBIT_KEYWORDS = ['مدين', 'debit', 'المدين', 'سحب', 'withdrawal', 'مبلغ مدين'];
const CREDIT_KEYWORDS = ['دائن', 'credit', 'الدائن', 'إيداع', 'deposit', 'مبلغ دائن'];
const BALANCE_KEYWORDS = ['رصيد', 'balance', 'الرصيد'];
const REF_KEYWORDS = ['مرجع', 'reference', 'المرجع', 'رقم المرجع', 'ref'];
const NOTES_KEYWORDS = ['ملاحظات', 'notes', 'ملاحظة', 'تعليق'];

function normalizedText(value: BankSheetCell): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function splitLabelValue(value: string): string {
  const parts = value.split(/[:：]/);
  return parts.length > 1 ? parts.slice(1).join(':').trim() : '';
}

export function isBankNameBlacklisted(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = normalizedText(value);
  return BANK_NAME_BLACKLIST.some((phrase) => normalized === normalizedText(phrase));
}

export function sanitizeBankName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (isBankNameBlacklisted(trimmed)) return '';
  if (trimmed.length > 60) return '';
  if (/^[\d\s\W]+$/.test(trimmed)) return '';
  return trimmed;
}

export function sanitizeCustomerName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (isBankNameBlacklisted(trimmed)) return '';
  if (trimmed.length > 120) return '';
  return trimmed;
}

export function extractDateFromCell(value: BankSheetCell): string {
  if (!value) return '';
  if (value instanceof Date) return formatSaudiDateISO(value);
  if (typeof value === 'number' && value > 40000 && value < 50000) {
    return formatSaudiDateISO(new Date((value - 25569) * 86400 * 1000));
  }
  const str = String(value).trim();
  const dmy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const ymd = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  return str;
}

function findAdjacentValue(row: BankSheetRow, index: number): string {
  if (index + 1 < row.length && row[index + 1]) return String(row[index + 1]).trim();
  return splitLabelValue(String(row[index] ?? ''));
}

function detectCustomerName(row: BankSheetRow, rowText: string): string {
  if (!CUSTOMER_NAME_KEYWORDS.some((keyword) => rowText.includes(keyword))) return '';
  for (let index = 0; index < row.length; index++) {
    const cellText = normalizedText(row[index]);
    if (!CUSTOMER_NAME_KEYWORDS.some((keyword) => cellText.includes(keyword))) continue;
    const candidate = sanitizeCustomerName(findAdjacentValue(row, index));
    if (candidate) return candidate;
  }
  return '';
}

function detectPeriod(row: BankSheetRow, current: Pick<BankDetectedRows, 'periodFrom' | 'periodTo'>): Pick<BankDetectedRows, 'periodFrom' | 'periodTo'> {
  let { periodFrom, periodTo } = current;
  for (let index = 0; index < row.length; index++) {
    const cellText = String(row[index] ?? '').trim();
    const cellLower = cellText.toLowerCase();
    if (!periodFrom && (cellLower.includes('من') || cellLower.includes('from') || cellLower.includes('تاريخ من') || cellLower.includes('start'))) {
      const adjacentDate = extractDateFromCell(row[index + 1]);
      const inlineDate = extractDateFromCell(splitLabelValue(cellText));
      periodFrom = adjacentDate || inlineDate || periodFrom;
    }
    if (!periodTo && (cellLower.includes('إلى') || cellLower.includes('to') || cellLower.includes('تاريخ إلى') || cellLower.includes('end'))) {
      const adjacentDate = extractDateFromCell(row[index + 1]);
      const inlineDate = extractDateFromCell(splitLabelValue(cellText));
      periodTo = adjacentDate || inlineDate || periodTo;
    }
    if (!periodFrom && !periodTo) {
      const dateRangeMatch = cellText.match(/(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4})\s*[-–]\s*(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4})/);
      if (dateRangeMatch) {
        periodFrom = extractDateFromCell(dateRangeMatch[1]);
        periodTo = extractDateFromCell(dateRangeMatch[2]);
      }
    }
  }
  return { periodFrom, periodTo };
}

function detectBankName(row: BankSheetRow, rowText: string): string {
  for (let index = 0; index < row.length; index++) {
    const cellText = String(row[index] ?? '').trim();
    const cellLower = cellText.toLowerCase();
    if (!BANK_LABEL_KEYWORDS.some((keyword) => cellLower === keyword || cellLower.startsWith(`${keyword}:`) || cellLower.startsWith(`${keyword}：`))) {
      continue;
    }
    const inlineCandidate = sanitizeBankName(splitLabelValue(cellText));
    if (inlineCandidate) return inlineCandidate;
    const adjacentCandidate = sanitizeBankName(row[index + 1] ? String(row[index + 1]).trim() : '');
    if (adjacentCandidate) return adjacentCandidate;
  }
  if (!BANK_KEYWORDS.some((keyword) => rowText.includes(keyword.toLowerCase()))) return '';
  const found = row.find((cell) => {
    const cellText = normalizedText(cell);
    return BANK_KEYWORDS.some((keyword) => cellText.includes(keyword.toLowerCase()));
  });
  return sanitizeBankName(found ? String(found) : '');
}

export function autoDetectRows(sheetData: BankSheetData): BankDetectedRows {
  let headerRow = 0;
  let dataStartRow = 1;
  let bankName = '';
  let customerName = '';
  let periodFrom = '';
  let periodTo = '';

  for (let index = 0; index < Math.min(sheetData.length, 30); index++) {
    const row = sheetData[index];
    const rowText = row.map((cell) => normalizedText(cell)).join(' ');

    if (index < 15 && !customerName) customerName = detectCustomerName(row, rowText);
    if (index < 15) ({ periodFrom, periodTo } = detectPeriod(row, { periodFrom, periodTo }));
    if (index < 15 && !bankName) bankName = detectBankName(row, rowText);

    const matchCount = HEADER_KEYWORDS.reduce((count, keyword) => count + (rowText.includes(keyword) ? 1 : 0), 0);
    if (matchCount >= 3) {
      headerRow = index;
      dataStartRow = index + 1;
      break;
    }
  }

  return { headerRow, dataStartRow, bankName, customerName, periodFrom, periodTo };
}

function matchHeader(headers: readonly string[], keywords: readonly string[]): number | null {
  for (let index = 0; index < headers.length; index++) {
    if (keywords.some((keyword) => headers[index].includes(keyword))) return index;
  }
  return null;
}

export function autoDetectColumns(sheetData: BankSheetData, headerRow: number, _dataStartRow: number): BankColumnMapping {
  const detected: BankColumnMapping = {};
  const row = sheetData[headerRow];
  if (!row) return detected;

  const headers = row.map((header) => normalizedText(header));
  const candidates: Array<[BankColumnKey, readonly string[]]> = [
    ['date', DATE_KEYWORDS],
    ['description', DESC_KEYWORDS],
    ['debit', DEBIT_KEYWORDS],
    ['credit', CREDIT_KEYWORDS],
    ['balance', BALANCE_KEYWORDS],
    ['reference', REF_KEYWORDS],
    ['notes', NOTES_KEYWORDS],
  ];

  for (const [key, keywords] of candidates) {
    const columnIndex = matchHeader(headers, keywords);
    if (columnIndex !== null) detected[key] = columnIndex;
  }
  return detected;
}

export function countDataRowsFrom(sheetData: BankSheetData | null | undefined, dataStartRow: number): number {
  if (!sheetData) return 0;
  return sheetData.slice(dataStartRow).filter((row) => row.some((cell) => cell !== '' && cell != null)).length;
}

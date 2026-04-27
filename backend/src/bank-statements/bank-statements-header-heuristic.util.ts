import { type BankRowMapping } from './bank-statement-row-parser';

/** مطابقة كلمات مفتاحية للعناوين الشائعة في كشوف الحساب */
const HEADER_KEYWORDS: Record<string, string[]> = {
  date: ['تاريخ', 'date', 'التاريخ', 'trans date', 'value date', 'قيمة', 'يوم', 'day'],
  description: ['وصف', 'description', 'الوصف', 'بيان', 'تفاصيل', 'details', 'narration', 'مفهوم', 'البيان', 'تفاصيل الحركة'],
  notes: ['ملاحظات', 'ملاحظة', 'note', 'notes', 'remarks', 'comment'],
  debit: ['مدين', 'debit', 'سحب', 'خصم', 'withdraw', 'صادر', 'المدين', 'مدين'],
  credit: ['دائن', 'credit', 'ايداع', 'إيداع', 'deposit', 'وارد', 'الدائن', 'دائن'],
  balance: ['رصيد', 'balance', 'الرصيد', 'الباقي', 'الرصيد السابق', 'الرصيد اللاحق'],
  amount: ['مبلغ', 'amount', 'المبلغ', 'قيمة', 'value', 'المبلغ'],
  reference: ['مرجع', 'reference', 'ref', 'رقم العملية', 'txn'],
};

/** حد أمان لحجم JSON في قاعدة البيانات (صفوف كاملة للربط لاحقاً) */
export const RAW_DATA_MAX_ROWS = 30_000;

/** أحرف تُشير لـ formula injection في Excel عند بدء الخلية بها */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/** تنظيف قيمة نصية من formula injection */
export function sanitizeCell(val: string): string {
  if (!val || val.length === 0) return val;
  if (FORMULA_PREFIXES.some((p) => val.startsWith(p))) return "'" + val;
  return val;
}

export type ColumnMapping = {
  dateCol?: number;
  descCol?: number;
  notesCol?: number;
  mergeNotesWithDescription?: boolean;
  debitCol?: number;
  creditCol?: number;
  amountCol?: number; // عمود واحد: موجب=دائن، سالب=مدين
  balanceCol?: number;
  refCol?: number;
};

export function toBankRowMapping(m: ColumnMapping): BankRowMapping | null {
  const dateCol = m.dateCol ?? -1;
  if (dateCol < 0) return null;
  return {
    dateCol,
    descCol: m.descCol,
    notesCol: m.notesCol,
    mergeNotesWithDescription: m.mergeNotesWithDescription,
    debitCol: m.debitCol,
    creditCol: m.creditCol,
    amountCol: m.amountCol,
    balanceCol: m.balanceCol,
    refCol: m.refCol,
  };
}

function matchHeaderType(cell: string): string | null {
  const s = String(cell ?? '').toLowerCase().trim();
  if (!s) return null;
  for (const [type, keywords] of Object.entries(HEADER_KEYWORDS)) {
    if (keywords.some((k) => s.includes(k.toLowerCase()))) return type;
  }
  return null;
}

/** بديل عند فشل Gemini: مسح الصفوف للعثور على صف العناوين */
export function heuristicDetection(
  raw: string[][],
): {
  companyName: string;
  reportDate: string;
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
  columnTypes: Record<number, string>;
} | null {
  if (!raw?.length || !Array.isArray(raw[0])) return null;
  const colCount = Math.max(...raw.map((r) => (Array.isArray(r) ? r.length : 0)), 1);
  const dataEndRow = Math.max(1, raw.length - 1);
  const maxScan = Math.min(15, raw.length - 1);

  for (let hr = 0; hr <= maxScan; hr++) {
    const headerCells = raw[hr] || [];
    const columnTypes: Record<number, string> = {};
    for (let i = 0; i < colCount; i++) {
      const t = matchHeaderType(headerCells[i]);
      columnTypes[i] = t || 'ignore';
    }
    const hasDate = Object.values(columnTypes).includes('date');
    const hasAmount =
      Object.values(columnTypes).some((t) => t === 'debit' || t === 'credit') ||
      Object.values(columnTypes).includes('amount');
    if (hasDate && hasAmount) {
      return {
        companyName: '',
        reportDate: '',
        headerRow: hr,
        dataStartRow: hr + 1,
        dataEndRow,
        columnTypes,
      };
    }
  }
  return null;
}

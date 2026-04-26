/**
 * اكتشاف تلقائي لصف العناوين والأعمدة — منقول من BankColumnMapper.jsx (Base44)
 * نفس الكلمات المفتاحية ونفس ترتيب المنطق.
 */
// @ts-nocheck — صفوف استيراد ديناميكية: تثبيت أنواع تدريجي
import { formatSaudiDateISO } from '../../../utils/saudiDate';

/**
 * عبارات تمثّل عناوين وثائق لا أسماء بنوك — يُرفض تعيينها كـ bankName تلقائياً.
 * تشمل: كشف الحساب / كشف حساب / بيان الحساب / bank statement / account statement …
 */
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

/**
 * يرجع true إذا كانت القيمة تطابق أحد عناوين الوثائق المعروفة ولا يُعتبر اسماً لبنك.
 * @param {string} value
 */
export function isBankNameBlacklisted(value) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  return BANK_NAME_BLACKLIST.some((phrase) => normalized === phrase.toLowerCase() || normalized === phrase.toLowerCase().replace(/\s+/g, ' '));
}

/**
 * يُنظّف اسم البنك القادم من الـ AI أو الاكتشاف التلقائي:
 * - يرفض العبارات المدرجة في القائمة السوداء
 * - يرفض النصوص الطويلة جداً (> 60 حرف) التي تشبه عناوين لا أسماء
 * - يرفض النصوص التي تحتوي فقط على أرقام أو رموز
 * @param {string} value
 * @returns {string}
 */
export function sanitizeBankName(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (isBankNameBlacklisted(trimmed)) return '';
  if (trimmed.length > 60) return '';
  if (/^[\d\s\W]+$/.test(trimmed)) return '';
  return trimmed;
}

/**
 * يُنظّف اسم العميل القادم من الـ AI:
 * - يرفض عناوين الوثائق (كشف الحساب…)
 * - يرفض أسماء البنوك المعروفة
 * @param {string} value
 */
export function sanitizeCustomerName(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (isBankNameBlacklisted(trimmed)) return '';
  if (trimmed.length > 120) return '';
  return trimmed;
}

export function extractDateFromCell(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return formatSaudiDateISO(val);
  }
  if (typeof val === 'number' && val > 40000 && val < 50000) {
    const d = new Date((val - 25569) * 86400 * 1000);
    return formatSaudiDateISO(d);
  }
  const str = String(val).trim();
  const m1 = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
  const m2 = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  return str;
}

/**
 * @param {unknown[][]} sheetData
 * @returns {{ headerRow: number, dataStartRow: number, bankName: string, customerName: string, periodFrom: string, periodTo: string }}
 */
export function autoDetectRows(sheetData) {
  let headerRow = 0;
  let dataStartRow = 1;
  let bankName = '';
  const headerKeywords = [
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
  const bankKeywords = [
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
    'العوال',
    'اليمامة',
  ];

  /** تسميات تشير إلى خلية اسم البنك */
  const bankLabelKeywords = [
    'اسم البنك',
    'البنك',
    'bank name',
    'bank',
    'جهة الإصدار',
    'المصرف',
  ];
  const customerNameKeywords = [
    'اسم العميل',
    'customer name',
    'account holder',
    'اسم صاحب الحساب',
    'صاحب الحساب',
    'account name',
    'client name',
  ];
  let customerName = '';
  let periodFrom = '';
  let periodTo = '';

  for (let i = 0; i < Math.min(sheetData.length, 30); i++) {
    const row = sheetData[i];
    if (!row) continue;
    const rowText = row.map((c) => String(c || '').toLowerCase()).join(' ');

    if (i < 15 && !customerName) {
      for (const ck of customerNameKeywords) {
        if (rowText.includes(ck)) {
          for (let j = 0; j < row.length; j++) {
            const cellText = String(row[j] || '').toLowerCase().trim();
            if (customerNameKeywords.some((k) => cellText.includes(k))) {
              if (j + 1 < row.length && row[j + 1]) {
                customerName = String(row[j + 1]).trim();
                break;
              }
              const parts = String(row[j]).split(/[:：]/);
              if (parts.length > 1 && parts[1].trim()) {
                customerName = parts[1].trim();
                break;
              }
            }
          }
          if (customerName) break;
        }
      }
    }

    if (i < 15) {
      for (let j = 0; j < row.length; j++) {
        const cellText = String(row[j] || '').trim();
        const cellLower = cellText.toLowerCase();

        if (
          !periodFrom &&
          (cellLower.includes('من') ||
            cellLower.includes('from') ||
            cellLower.includes('تاريخ من') ||
            cellLower.includes('start'))
        ) {
          if (j + 1 < row.length && row[j + 1]) {
            const dateStr = extractDateFromCell(row[j + 1]);
            if (dateStr) periodFrom = dateStr;
          }
          const parts = cellText.split(/[:：]/);
          if (!periodFrom && parts.length > 1) {
            const dateStr = extractDateFromCell(parts[1].trim());
            if (dateStr) periodFrom = dateStr;
          }
        }

        if (
          !periodTo &&
          (cellLower.includes('إلى') ||
            cellLower.includes('to') ||
            cellLower.includes('تاريخ إلى') ||
            cellLower.includes('end'))
        ) {
          if (j + 1 < row.length && row[j + 1]) {
            const dateStr = extractDateFromCell(row[j + 1]);
            if (dateStr) periodTo = dateStr;
          }
          const parts = cellText.split(/[:：]/);
          if (!periodTo && parts.length > 1) {
            const dateStr = extractDateFromCell(parts[1].trim());
            if (dateStr) periodTo = dateStr;
          }
        }

        if (!periodFrom && !periodTo) {
          const dateRangeMatch = cellText.match(
            /(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4})\s*[-–]\s*(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4})/,
          );
          if (dateRangeMatch) {
            periodFrom = dateRangeMatch[1];
            periodTo = dateRangeMatch[2];
          }
        }
      }
    }

    if (i < 15 && !bankName) {
      // أولاً: ابحث عن خلية تحتوي على تسمية "اسم البنك" أو "البنك" وأخذ قيمة الخلية التالية
      for (let j = 0; j < row.length; j++) {
        const cellText = String(row[j] || '').trim();
        const cellLower = cellText.toLowerCase();
        if (bankLabelKeywords.some((lk) => cellLower === lk.toLowerCase() || cellLower.startsWith(lk.toLowerCase() + ':') || cellLower.startsWith(lk.toLowerCase() + '：'))) {
          // القيمة قد تكون في نفس الخلية بعد ":"  أو في الخلية التالية
          const parts = cellText.split(/[:：]/);
          if (parts.length > 1 && parts[1].trim()) {
            const candidate = sanitizeBankName(parts[1].trim());
            if (candidate) { bankName = candidate; break; }
          }
          if (j + 1 < row.length && row[j + 1]) {
            const candidate = sanitizeBankName(String(row[j + 1]).trim());
            if (candidate) { bankName = candidate; break; }
          }
        }
      }
      // ثانياً: إذا لم نجد عبر التسمية، ابحث عن خلية تحتوي على اسم بنك معروف
      if (!bankName) {
        for (const bk of bankKeywords) {
          if (rowText.includes(bk.toLowerCase())) {
            const found = row.find((c) => {
              const s = String(c || '').toLowerCase();
              return bankKeywords.some((k) => s.includes(k.toLowerCase()));
            });
            if (found) {
              const candidate = sanitizeBankName(String(found));
              if (candidate) { bankName = candidate; break; }
            }
          }
        }
      }
    }

    let matchCount = 0;
    for (const kw of headerKeywords) {
      if (rowText.includes(kw)) matchCount++;
    }
    if (matchCount >= 3) {
      headerRow = i;
      dataStartRow = i + 1;
      break;
    }
  }

  return { headerRow, dataStartRow, bankName, customerName, periodFrom, periodTo };
}

/**
 * @param {unknown[][]} sheetData
 * @param {number} headerRow
 * @param {number} dataStartRow
 * @returns {Record<string, number>} keys: date, description, debit, credit, balance, reference, notes
 */
export function autoDetectColumns(sheetData, headerRow, dataStartRow) {
  const detected: Record<string, number> = {};
  if (!sheetData || !sheetData[headerRow]) return detected;

  const headers = sheetData[headerRow].map((h) => String(h || '').trim().toLowerCase());

  const dateKeywords = ['تاريخ', 'date', 'التاريخ', 'تاريخ العملية', 'transaction date', 'تاريخ القيد'];
  const descKeywords = ['وصف', 'بيان', 'description', 'الوصف', 'البيان', 'تفاصيل', 'details'];
  const debitKeywords = ['مدين', 'debit', 'المدين', 'سحب', 'withdrawal', 'مبلغ مدين'];
  const creditKeywords = ['دائن', 'credit', 'الدائن', 'إيداع', 'deposit', 'مبلغ دائن'];
  const balanceKeywords = ['رصيد', 'balance', 'الرصيد'];
  const refKeywords = ['مرجع', 'reference', 'المرجع', 'رقم المرجع', 'ref'];
  const notesKeywords = ['ملاحظات', 'notes', 'ملاحظة', 'تعليق'];

  const matchHeader = (keywords) => {
    for (let i = 0; i < headers.length; i++) {
      for (const kw of keywords) {
        if (headers[i].includes(kw)) return i;
      }
    }
    return null;
  };

  const dateCol = matchHeader(dateKeywords);
  const descCol = matchHeader(descKeywords);
  const debitCol = matchHeader(debitKeywords);
  const creditCol = matchHeader(creditKeywords);
  const balanceCol = matchHeader(balanceKeywords);
  const refCol = matchHeader(refKeywords);
  const notesCol = matchHeader(notesKeywords);

  if (dateCol !== null) detected.date = dateCol;
  if (descCol !== null) detected.description = descCol;
  if (debitCol !== null) detected.debit = debitCol;
  if (creditCol !== null) detected.credit = creditCol;
  if (balanceCol !== null) detected.balance = balanceCol;
  if (refCol !== null) detected.reference = refCol;
  if (notesCol !== null) detected.notes = notesCol;

  return detected;
}

/**
 * عدد صفوف البيانات الفعلية من dataStartRow حتى النهاية (تجاهل الفارغة) — مطابق المنطق في القديم
 * @param {unknown[][]} sheetData
 * @param {number} dataStartRow
 */
export function countDataRowsFrom(sheetData, dataStartRow) {
  if (!sheetData) return 0;
  return sheetData.slice(dataStartRow).filter((r) => r && r.some((c) => c !== '' && c != null)).length;
}

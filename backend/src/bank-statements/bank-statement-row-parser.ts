/**
 * استخراج حركات الكشف — مطابقة منطق applyTemplate في Base44 (analyzeBankStatement.ts)
 */

const AR_NUMS = '٠١٢٣٤٥٦٧٨٩';
function toWesternNum(str: string): string {
  if (str == null) return '';
  return String(str).replace(/[٠-٩]/g, (c) => AR_NUMS.indexOf(c).toString());
}

/** تاريخ ISO YYYY-MM-DD أو '' */
export function parseBankDateCell(rawDate: unknown): string {
  if (rawDate == null || rawDate === '') return '';
  if (rawDate instanceof Date) {
    const y = rawDate.getFullYear();
    if (y >= 1900 && y <= 2100) return rawDate.toISOString().slice(0, 10);
    return '';
  }
  if (typeof rawDate === 'number') {
    if (rawDate > 1 && rawDate < 200000) {
      const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
      const y = d.getFullYear();
      if (y >= 1900 && y <= 2100) return d.toISOString().slice(0, 10);
    }
    return '';
  }
  let dateStr = toWesternNum(String(rawDate).trim()).replace(/\s+/g, ' ').trim();

  const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyyMatch) {
    const part1 = parseInt(ddmmyyyyMatch[1], 10);
    const part2 = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);
    if (year < 1900 || year > 2100) return '';
    let day: number;
    let month: number;
    if (part1 > 12) {
      day = part1;
      month = part2;
    } else if (part2 > 12) {
      day = part2;
      month = part1;
    } else {
      day = part1;
      month = part2;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }

  const ymd = dateStr.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10);
    const day = parseInt(ymd[3], 10);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }

  const numbersMatch = dateStr.match(/(\d{1,4})[\/\-\.\s]+(\d{1,2})[\/\-\.\s]+(\d{1,4})/);
  if (numbersMatch) {
    const n1 = parseInt(numbersMatch[1], 10);
    const n2 = parseInt(numbersMatch[2], 10);
    const n3 = parseInt(numbersMatch[3], 10);
    let year: number;
    let month: number;
    let day: number;
    if (n1 > 1900 && n1 <= 2100) {
      year = n1;
      month = n2;
      day = n3;
    } else if (n3 > 1900 && n3 <= 2100) {
      year = n3;
      day = n1;
      month = n2;
    } else {
      return '';
    }
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const str = toWesternNum(String(rawDate).trim());
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    if (y >= 1900 && y <= 2100) return d.toISOString().slice(0, 10);
  }
  return '';
}

export function parseBankAmount(val: unknown): number {
  return Math.abs(parseFloat(String(val ?? '0').replace(/[^0-9.-]/g, '')) || 0);
}

export type BankRowMapping = {
  dateCol: number;
  descCol?: number;
  notesCol?: number;
  mergeNotesWithDescription?: boolean;
  debitCol?: number;
  creditCol?: number;
  amountCol?: number;
  balanceCol?: number;
  refCol?: number;
};

export type ParsedBankRow = {
  txDate: string;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
  reference: string;
  sortOrder: number;
};

/**
 * يتخطى الصف فقط إذا مدين=دائن=رصيد=0 (مثل Base44).
 * يُدرج صف برصيد فقط أو مدين/دائن فقط.
 */
export function parseBankStatementRows(
  raw: unknown[][],
  map: BankRowMapping,
  dataStartRow: number,
  dataEndRow: number,
  fallbackDate?: string | null,
): ParsedBankRow[] {
  const start = Math.max(0, dataStartRow);
  const end = Math.min(raw.length - 1, dataEndRow);
  const out: ParsedBankRow[] = [];
  let order = 0;

  const dateCol = map.dateCol;
  if (dateCol < 0) return out;

  for (let i = start; i <= end; i++) {
    const row = raw[i];
    if (!row || !Array.isArray(row)) continue;
    const hasData = row.some((cell) => cell !== null && cell !== undefined && cell !== '');
    if (!hasData) continue;

    let txDate = parseBankDateCell(row[dateCol]);
    if (!txDate && fallbackDate) txDate = String(fallbackDate).slice(0, 10);

    let description = '';
    if (map.descCol != null && map.descCol >= 0) {
      description = String(row[map.descCol] ?? '').trim();
    }
    if (map.notesCol != null && map.notesCol >= 0 && map.mergeNotesWithDescription !== false) {
      const notes = String(row[map.notesCol] ?? '').trim();
      if (notes && notes !== description) {
        description = notes + (description ? ' - ' + description : '');
      }
    }

    let debit = map.debitCol != null && map.debitCol >= 0 ? parseBankAmount(row[map.debitCol]) : 0;
    let credit = map.creditCol != null && map.creditCol >= 0 ? parseBankAmount(row[map.creditCol]) : 0;
    const amountVal = map.amountCol != null && map.amountCol >= 0 ? parseBankAmount(row[map.amountCol]) : null;
    if (amountVal != null && amountVal !== 0) {
      if (amountVal > 0) credit = amountVal;
      else debit = Math.abs(amountVal);
    }

    const balRaw = map.balanceCol != null && map.balanceCol >= 0 ? parseBankAmount(row[map.balanceCol]) : 0;
    const balance = map.balanceCol != null && map.balanceCol >= 0 && row[map.balanceCol] != null && row[map.balanceCol] !== '' ? balRaw : null;

    const reference =
      map.refCol != null && map.refCol >= 0 ? String(row[map.refCol] ?? '').trim() : '';

    if (debit === 0 && credit === 0 && (balance === null || balance === 0)) continue;

    if (!txDate) continue;

    out.push({
      txDate,
      description,
      debit,
      credit,
      balance,
      reference,
      sortOrder: order++,
    });
  }

  return out;
}

/** نسبة الصلاحية مثل Base44: تاريخ + (مدين أو دائن) */
export function countTemplateValidRows(rows: ParsedBankRow[]): { valid: number; total: number } {
  const total = rows.length;
  const valid = rows.filter((r) => r.txDate && (r.debit > 0 || r.credit > 0)).length;
  return { valid, total };
}

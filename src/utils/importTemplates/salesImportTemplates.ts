import { exportToExcel } from '../exportUtils';
import { toYmd } from '../saudiDate';
import { matchByName, parseDate, parseNumber } from './core';
import type { ImportRow, LookupItem, ValidationResult } from './core';

// ─── Sales Template ──────────────────────────────────────────────────────────

/** vaults: array of vault objects with nameAr/nameEn */
export async function downloadSalesTemplate(vaults: unknown[] = []) {
  const vaultColumns =
    vaults.length > 0
      ? vaults.reduce<Record<string, number>>((acc, v) => {
          const row = v as LookupItem;
          acc[`قناة: ${String(row.nameAr ?? row.nameEn ?? row.id ?? '')}`] = 0;
          return acc;
        }, {})
      : { 'قناة: الصندوق الرئيسي': 5000, 'قناة: شبكة البنك': 3000 };

  const rows = [
    {
      'تاريخ اليوم': '2025-01-15',
      'عدد العملاء': 120,
      'النقد في اليد': 200,
      'ملاحظات': 'صف مثال — احذفه واستبدله ببياناتك',
      ...vaultColumns,
    },
  ];
  await exportToExcel(rows, 'template-daily-sales.xlsx');
}

// ─── Sales Row Validator ─────────────────────────────────────────────────────

/**
 * @param {Object[]} rows
 * @param {{ vaults: Object[] }} options
 * @returns {{ rowNum: number, valid: boolean, errors: string[], warnings: string[], payload: Object|null }[]}
 */
export function validateSalesRows(
  rows: ImportRow[],
  { vaults = [] }: { vaults?: unknown[] } = {},
) {
  const seenDates = new Set<string>();

  return rows.map((row, i): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const rowNum = i + 2;

    const dateRaw = row['تاريخ اليوم'] ?? row['transactionDate'] ?? row['التاريخ'] ?? row['date'];
    const transactionDate = parseDate(dateRaw);
    if (!transactionDate) {
      errors.push('تاريخ اليوم مطلوب أو غير صحيح');
    } else if (seenDates.has(transactionDate)) {
      errors.push(`التاريخ ${transactionDate} مكرر في الملف`);
    } else {
      seenDates.add(transactionDate);
    }

    const customerCount = Math.max(0, parseNumber(row['عدد العملاء'] ?? row['customerCount'] ?? 0) ?? 0);
    const cashOnHand = String(Math.max(0, parseNumber(row['النقد في اليد'] ?? row['cashOnHand'] ?? 0) ?? 0));
    const notes = String(row['ملاحظات'] ?? row['notes'] ?? '').trim() || undefined;

    // Extract vault channels from columns prefixed with "قناة: " or "channel: "
    const channels: { vaultId: string; amount: string }[] = [];
    for (const [colKey, rawAmount] of Object.entries(row)) {
      const prefix = colKey.startsWith('قناة: ') ? 'قناة: ' : colKey.startsWith('channel: ') ? 'channel: ' : null;
      if (!prefix) continue;
      const vaultName = colKey.slice(prefix.length).trim();
      const amt = parseNumber(rawAmount);
      if (!amt || amt <= 0) continue;
      const vault = matchByName(vaults, vaultName);
      if (vault) {
        channels.push({ vaultId: String(vault.id ?? ''), amount: String(amt) });
      } else {
        warnings.push(`الصندوق "${vaultName}" غير موجود في النظام`);
      }
    }

    if (channels.length === 0 && errors.length === 0) {
      errors.push('يجب تحديد قناة بيع واحدة على الأقل بمبلغ أكبر من صفر');
    }

    return {
      rowNum,
      errors,
      warnings,
      valid: errors.length === 0,
      payload: errors.length === 0
        ? { transactionDate, customerCount, cashOnHand, notes, channels }
        : null,
    };
  });
}

export function formatSalesForExport(summary: Record<string, unknown>) {
  const base: Record<string, unknown> = {
    'تاريخ اليوم': toYmd(summary.transactionDate),
    'رقم الملخص': summary.summaryNumber ?? '',
    'عدد العملاء': summary.customerCount ?? 0,
    'إجمالي المبيعات': summary.totalAmount ?? '',
    'النقد في اليد': summary.cashOnHand ?? '',
    'الحالة': summary.status === 'active' ? 'نشط' : 'ملغى',
    'ملاحظات': summary.notes ?? '',
  };
  const chList = (summary.channels ?? []) as unknown[];
  chList.forEach((ch) => {
    const c = ch as LookupItem;
    const v = c.vault as Record<string, unknown> | undefined;
    const label = String(v?.nameAr ?? v?.nameEn ?? c.vaultId ?? '');
    base[`قناة: ${label}`] = c.amount;
  });
  return base;
}

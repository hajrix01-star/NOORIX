import { Logger } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  templateColumnsToMapping,
  type TemplateColumnsJson,
} from './bank-template-columns.util';
import { parseBankStatementRows, countTemplateValidRows } from './bank-statement-row-parser';
import { RAW_DATA_MAX_ROWS, toBankRowMapping, type ColumnMapping } from './bank-statements-header-heuristic.util';

/**
 * يحاول تطبيق أول قالب بنكي نشط يطابق عناوين الملف — يُحدّث السجل ويرفع usageCount.
 * @returns `skipAi` إذا اكتمل التعيين من القالب (لا حاجة لـ Gemini/Heuristic).
 */
export async function tryApplyMatchingBankTemplate(
  prisma: TenantPrismaService,
  logger: Logger,
  companyId: string,
  statementId: string,
  rawForParse: unknown[][],
  rawTruncated: boolean,
): Promise<{ skipAi: boolean }> {
  const templates = await prisma.bankStatementTemplate.findMany({
    where: { companyId, isActive: true },
    orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
  });
  for (const tpl of templates) {
    if (tpl.headerRow < 0 || tpl.headerRow >= rawForParse.length) continue;
    const currentHeaders = (rawForParse[tpl.headerRow] || [])
      .map((h) => String(h || '').toLowerCase().trim())
      .filter(Boolean);
    const saved = (Array.isArray(tpl.sampleHeaders) ? tpl.sampleHeaders : [])
      .map((h: unknown) => String(h || '').toLowerCase().trim())
      .filter(Boolean);
    if (currentHeaders.length === 0 || saved.length === 0) continue;
    const matchCount = saved.filter((h: string) => currentHeaders.includes(h)).length;
    const pct = matchCount / saved.length;
    if (pct < 0.85) continue;
    const colMap = templateColumnsToMapping((tpl.columnsJson || {}) as TemplateColumnsJson);
    const maxCol = Math.max(
      colMap.dateCol ?? -1,
      colMap.descCol ?? -1,
      colMap.notesCol ?? -1,
      colMap.debitCol ?? -1,
      colMap.creditCol ?? -1,
      colMap.balanceCol ?? -1,
      colMap.amountCol ?? -1,
      colMap.refCol ?? -1,
    );
    const sampleRow = rawForParse[tpl.dataStartRow];
    if (!sampleRow || sampleRow.length <= maxCol) continue;

    const dataEnd =
      tpl.dataEndRow === -1 ? Math.max(0, rawForParse.length - 1) : Math.min(tpl.dataEndRow, rawForParse.length - 1);
    const brm = toBankRowMapping(colMap as ColumnMapping);
    if (brm) {
      const parsed = parseBankStatementRows(rawForParse, brm, tpl.dataStartRow, dataEnd, null);
      const { valid, total } = countTemplateValidRows(parsed);
      const ratio = total > 0 ? valid / total : 0;
      if (total < 3 || ratio < 0.5) {
        logger.warn(
          `Bank template ${tpl.bankName} poor parse: ${valid}/${total} valid — deactivating (Base44 parity)`,
        );
        await prisma.bankStatementTemplate.update({
          where: { id: tpl.id },
          data: { isActive: false },
        });
        continue;
      }
    }

    await prisma.bankStatement.update({
      where: { id: statementId },
      data: {
        companyName: tpl.customerName || '',
        bankName: tpl.bankName || 'كشف الحساب',
        headerRow: tpl.headerRow,
        dataStartRow: tpl.dataStartRow,
        dataEndRow: dataEnd,
        columnMapping: colMap as object,
        aiAnalysis:
          (rawTruncated ? `تنبيه: الملف قُصّ إلى ${RAW_DATA_MAX_ROWS} صفاً. ` : '') +
          `قالب محفوظ: ${tpl.bankName} — تطابق عناوين ${Math.round(pct * 100)}%`,
      },
    });
    await prisma.bankStatementTemplate.update({
      where: { id: tpl.id },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    });
    logger.log(`Bank template matched: ${tpl.bankName} (${Math.round(pct * 100)}%)`);
    return { skipAi: true };
  }
  return { skipAi: false };
}

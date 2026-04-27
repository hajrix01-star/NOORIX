import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { RAW_DATA_MAX_ROWS, type ColumnMapping } from './bank-statements-header-heuristic.util';

export function columnTypesRecordToColumnMapping(columnTypes: Record<number, string>): ColumnMapping {
  const colMap: ColumnMapping = {};
  for (const [k, v] of Object.entries(columnTypes)) {
    const col = parseInt(k, 10);
    if (v === 'date') colMap.dateCol = col;
    else if (v === 'description') colMap.descCol = col;
    else if (v === 'notes') {
      colMap.notesCol = col;
      colMap.mergeNotesWithDescription = true;
    } else if (v === 'debit') colMap.debitCol = col;
    else if (v === 'credit') colMap.creditCol = col;
    else if (v === 'balance') colMap.balanceCol = col;
    else if (v === 'amount') colMap.amountCol = col;
    else if (v === 'reference') colMap.refCol = col;
  }
  return colMap;
}

export type BankStatementStructureSuggestion = {
  companyName: string;
  reportDate: string;
  dataStartRow: number;
  dataEndRow: number;
  headerRow: number;
  columnTypes: Record<number, string>;
};

/** يطبّق نتيجة Gemini أو الـ heuristic على سجل الكشف (خريطة أعمدة + صفوف). */
export async function applyStructureSuggestionToBankStatement(
  prisma: TenantPrismaService,
  statementId: string,
  suggested: BankStatementStructureSuggestion,
  rawTruncated: boolean,
): Promise<void> {
  const colMap = columnTypesRecordToColumnMapping(suggested.columnTypes);
  await prisma.bankStatement.update({
    where: { id: statementId },
    data: {
      companyName: suggested.companyName || '',
      startDate: suggested.reportDate ? `${suggested.reportDate}-01` : null,
      endDate: suggested.reportDate ? `${suggested.reportDate}-28` : null,
      headerRow: suggested.headerRow,
      dataStartRow: suggested.dataStartRow,
      dataEndRow: suggested.dataEndRow,
      columnMapping: colMap as object,
      ...(rawTruncated
        ? {
            aiAnalysis: `تنبيه: الملف قُصّ إلى ${RAW_DATA_MAX_ROWS} صفاً للتخزين.`,
          }
        : {}),
    },
  });
}

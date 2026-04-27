import { BadRequestException, Logger } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { GeminiService } from '../chat/gemini.service';
import {
  RAW_DATA_MAX_ROWS,
  heuristicDetection,
} from './bank-statements-header-heuristic.util';
import { tryApplyMatchingBankTemplate } from './bank-statements-template-matcher.util';
import {
  applyStructureSuggestionToBankStatement,
  type BankStatementStructureSuggestion,
} from './bank-statements-structure-suggestion.util';

/**
 * رفع خام + قالب/تحليل أعمدة، ثم إرجاع معرف السجل الجديد.
 */
export async function createBankStatementAfterUploadAndStructure(
  deps: {
    prisma: TenantPrismaService;
    logger: Logger;
    geminiService: GeminiService;
  },
  companyId: string,
  dto: { fileName: string; fileFormat: string; raw: string[][] },
): Promise<string> {
  const { prisma, logger, geminiService } = deps;
  const tenantId = TenantContext.getTenantId();
  if (!dto.raw?.length) throw new BadRequestException('الملف فارغ');

  const allowedFormats = ['excel', 'xlsx', 'xls', 'csv'];
  if (dto.fileFormat && !allowedFormats.includes(dto.fileFormat.toLowerCase())) {
    throw new BadRequestException('صيغة الملف غير مدعومة — يُقبل xlsx وxls وcsv فقط');
  }

  const raw = dto.raw as string[][];
  const rawTruncated = raw.length > RAW_DATA_MAX_ROWS;
  const rawData = (rawTruncated ? raw.slice(0, RAW_DATA_MAX_ROWS) : raw) as unknown[][];
  if (rawTruncated) {
    logger.warn(`Bank upload: truncated raw from ${raw.length} to ${RAW_DATA_MAX_ROWS} rows`);
  }

  const stmt = await prisma.bankStatement.create({
    data: {
      tenantId,
      companyId,
      fileName: dto.fileName || 'كشف.xlsx',
      fileFormat: dto.fileFormat || 'excel',
      companyName: '',
      bankName: 'كشف الحساب',
      status: 'mapping',
      headerRow: 0,
      dataStartRow: 0,
      dataEndRow: Math.max(0, raw.length - 1),
      rawData: rawData as object,
    },
  });

  const rawForParse = rawData as unknown[][];
  const { skipAi } = await tryApplyMatchingBankTemplate(
    prisma,
    logger,
    companyId,
    stmt.id,
    rawForParse,
    rawTruncated,
  );

  let suggested: BankStatementStructureSuggestion | null = null;

  if (!skipAi && geminiService.isAvailable()) {
    suggested = await geminiService.analyzeBankStatementStructure(rawForParse as string[][]);
  }
  if (!skipAi && !suggested) {
    suggested = heuristicDetection(rawForParse as string[][]) as BankStatementStructureSuggestion | null;
    if (suggested) logger.log('Using heuristic fallback for column detection');
  }
  if (suggested) {
    await applyStructureSuggestionToBankStatement(prisma, stmt.id, suggested, rawTruncated);
  }

  return stmt.id;
}

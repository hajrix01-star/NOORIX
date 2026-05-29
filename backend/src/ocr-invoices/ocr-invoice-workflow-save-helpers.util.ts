/**
 * منطق مشترك بين حفظ فاتورة OCR واعتماد سجل بانتظار المراجعة:
 * مطابقة أصناف + تسجيل تاريخ الأسعار (مع تطبيع الضريبة).
 */
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { extractSizeFromName, findBestItemMatch, normalizeItemForSearch } from './ocr-item-name-match.util';
import type { SaveInvoiceLineDto } from './dto/save-invoice.dto';

type CatalogRow = Prisma.OcrItemGetPayload<{ include: { aliases: true } }>;

export type ProcessedOcrLine = Omit<SaveInvoiceLineDto, 'itemId' | 'matchStatus'> & {
  itemId: string | null;
  matchStatus: string;
};
const ARABIC_TEXT_RE = /[\u0600-\u06FF]/;

function log(
  l: { log: (m: string) => void } | undefined,
  message: string,
) {
  l?.log(message);
}

/**
 * يعالج سطور الفاتورة: مطابقة كتالوج أو إنشاء صنف/alias.
 * يضيف الأصناف المُحدثة فوق `workCatalog` عند إضافة أصناف جديدة.
 */
export async function processOcrLinesAgainstCatalog(
  prisma: PrismaService,
  tenantId: string,
  companyId: string,
  lines: SaveInvoiceLineDto[],
  workCatalog: CatalogRow[],
  logSink?: { log: (m: string) => void },
): Promise<ProcessedOcrLine[]> {
  return Promise.all(
    lines.map(async (line) => {
      let itemId = line.itemId || null;
      if (!itemId && line.rawName?.trim()) {
        const lineExt = line as {
          nameAr?: string;
          nameEn?: string;
          size?: string;
          sizeUnit?: string;
        };
        const nameAr = lineExt.nameAr?.trim() || null;
        const nameEn = lineExt.nameEn?.trim() || null;
        const parsedRawSize = extractSizeFromName(line.rawName.trim());
        const lineSize = lineExt.size || parsedRawSize.size || null;
        const lineSizeUnit = lineExt.sizeUnit || parsedRawSize.sizeUnit || null;

        let searchName: string;
        if (nameAr || nameEn) {
          searchName = nameAr || nameEn!;
        } else {
          const extracted = normalizeItemForSearch(line.rawName.trim());
          searchName = extracted.ar || extracted.en || line.rawName.trim();
        }

        const matchResult = findBestItemMatch(searchName, workCatalog, {
          querySize: lineSize,
          queryUnit: lineSizeUnit,
        });
        if (matchResult && matchResult.score >= 0.78 && matchResult.autoEligible !== false) {
          itemId = matchResult.item.id;
          if (lineSize) {
            await prisma.ocrItem
              .update({ where: { id: itemId }, data: { hasSizes: true } })
              .catch(() => {});
          }
          log(
            logSink,
            `Smart-matched item "${searchName}" → "${matchResult.item.nameAr}" (score: ${matchResult.score.toFixed(2)})`,
          );
        } else if (matchResult && matchResult.score >= 0.78) {
          log(
            logSink,
            `Size gate held item "${searchName}" as pending review (score: ${matchResult.score.toFixed(2)} flags=${matchResult.sizeGate.flags.join(',') || 'none'})`,
          );
          return {
            ...line,
            itemId: null,
            matchStatus: 'pending',
          };
        } else {
          const normalizedNames = normalizeItemForSearch(line.rawName.trim());
          const candidateAr = nameAr || normalizedNames.ar || null;
          const cleanAr = candidateAr && ARABIC_TEXT_RE.test(candidateAr) ? candidateAr : null;
          const cleanEn = nameEn || normalizedNames.en || line.rawName.trim() || null;

          // قاعدة صارمة: إذا لا يوجد عربي فعلي، لا نُنشئ صنفاً جديداً لتجنب تلويث nameAr.
          if (!cleanAr) {
            log(
              logSink,
              `Skipped auto-create item for non-Arabic name "${line.rawName.trim()}"; kept as pending review`,
            );
            return {
              ...line,
              itemId: null,
              nameEn: cleanEn || undefined,
              matchStatus: 'pending',
            };
          }

          const newItem = await prisma.ocrItem.create({
            data: {
              tenantId,
              companyId,
              nameAr: cleanAr,
              nameEn: cleanEn,
              hasSizes: !!lineSize,
            },
          });
          itemId = newItem.id;
          const rawTrimmed = line.rawName.trim();
          if (rawTrimmed !== cleanAr) {
            await prisma.ocrItemAlias
              .create({
                data: {
                  itemId,
                  alias: rawTrimmed,
                  language: ARABIC_TEXT_RE.test(rawTrimmed) ? 'ar' : 'en',
                  addedBy: 'ocr-auto',
                },
              })
              .catch(() => {});
          }
            workCatalog.push(
              { ...newItem, nameEn: cleanEn, hasSizes: !!lineSize, aliases: [] } as CatalogRow,
            );
          log(logSink, `Auto-created OCR item: "${cleanAr}" (${newItem.id})`);
        }
      }
      return {
        ...line,
        itemId,
        matchStatus: itemId && line.itemId ? (line.matchStatus || 'matched') : itemId ? 'new' : 'pending',
      } as ProcessedOcrLine;
    }),
  );
}

/** يجمع عامل تطبيع السعر عندما تكون أجزاء السطور بضريبة مضمّنة. */
function computeVatPriceNormFactor(
  lineSum: number,
  subTotal: number | null,
  grandTotal: number | null,
  vatAmt: number | null,
  impliedVatRate: number,
): number {
  if (!vatAmt || vatAmt <= 0 || lineSum <= 0) return 1.0;
  if (subTotal && grandTotal) {
    const diffFromSubtotal = Math.abs(lineSum - subTotal) / subTotal;
    const diffFromTotal = Math.abs(lineSum - grandTotal) / grandTotal;
    if (diffFromTotal < diffFromSubtotal && diffFromTotal < 0.06) {
      return 1 / (1 + impliedVatRate);
    }
  } else if (grandTotal) {
    const diffFromTotal = Math.abs(lineSum - grandTotal) / grandTotal;
    if (diffFromTotal < 0.06) return 1 / (1 + impliedVatRate);
  }
  return 1.0;
}

export function impliedVatRateFromAmounts(
  vatAmt: number | null,
  subTotal: number | null,
  grandTotal: number | null,
): number {
  if (vatAmt && subTotal && subTotal > 0) return vatAmt / subTotal;
  if (vatAmt && grandTotal && grandTotal > vatAmt) return vatAmt / (grandTotal - vatAmt);
  return 0.15;
}

/** كتابة OcrPriceHistory لكل سطر بسعر (بعد تطبيع الضريبة إن وُجد). */
export async function recordOcrPriceHistoryForProcessedLines(
  prisma: PrismaService,
  tenantId: string,
  companyId: string,
  supplierId: string | null,
  invoiceDate: string | null | Date | undefined,
  processedLines: ProcessedOcrLine[],
  invoiceId: string,
  opts: { subtotalAmount: number | null; totalAmount: number | null; vatAmount: number | null },
): Promise<void> {
  if (!supplierId || !invoiceDate) return;
  const lineSum = processedLines.reduce((s, l) => {
    const up = Number(l.unitPrice) || 0;
    const qty = Number(l.quantity) || 1;
    return s + up * qty;
  }, 0);

  const subTotal = opts.subtotalAmount;
  const grandTotal = opts.totalAmount;
  const vatAmt = opts.vatAmount;
  const impliedVat = impliedVatRateFromAmounts(
    vatAmt != null ? vatAmt : null,
    subTotal != null ? subTotal : null,
    grandTotal != null ? grandTotal : null,
  );
  const normFactor = computeVatPriceNormFactor(
    lineSum,
    subTotal != null ? subTotal : null,
    grandTotal != null ? grandTotal : null,
    vatAmt != null ? vatAmt : null,
    impliedVat,
  );

  const d =
    typeof invoiceDate === 'string' ? new Date(invoiceDate) : invoiceDate instanceof Date ? invoiceDate : null;
  if (!d) return;

  for (const line of processedLines) {
    if (line.itemId && line.unitPrice) {
      const normalizedPrice = Math.round(Number(line.unitPrice) * normFactor * 1000) / 1000;
      const lineExt = line as { size?: string; sizeUnit?: string };
      await prisma.ocrPriceHistory.create({
        data: {
          tenantId,
          companyId,
          itemId: line.itemId,
          supplierId,
          price: normalizedPrice,
          size: lineExt.size || null,
          sizeUnit: lineExt.sizeUnit || null,
          invoiceDate: d,
          invoiceId,
        },
      });
    }
  }
}

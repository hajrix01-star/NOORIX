import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { toYmd } from '../common/utils/to-ymd.util';
import { normalize } from './ocr-normalize.util';

const NON_CRITICAL_SEMANTIC_TOKENS = new Set([
  'فاخر',
  'مزايا',
  'اصلي',
  'اصليه',
  'صغير',
  'كبير',
  'وسط',
  'جديد',
  'قديم',
  'عرض',
  'خاص',
  'مفري',
  'مفرد',
  'عبوه',
  'حبه',
  'حبات',
  'قطعه',
  'قطع',
  'pack',
  'bundle',
  'ctn',
  'carton',
]);
const PACKAGING_TOKEN_RE =
  /^(?:شد(?:ه)?|ربطه|رزمة|كرتون|pack|bundle|ctn|carton|box|pcs?|pc)$/i;

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, x) => s + x, 0) / nums.length;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (v && typeof v === 'object' && typeof (v as { toString?: () => string }).toString === 'function') {
    const n = Number((v as { toString: () => string }).toString());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function canonicalizeSemanticToken(token: string): string {
  let t = token.trim();
  if (!t) return '';
  if (t.length >= 4 && t.endsWith('ه')) t = t.slice(0, -1);
  if (t.length >= 5 && t.endsWith('ات')) t = t.slice(0, -2);
  return t;
}

export function extractSemanticTokens(text: string): string[] {
  if (!text) return [];
  return Array.from(
    new Set(
      normalize(text)
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .filter((t) => !/^\d+(?:[.,]\d+)?$/.test(t))
        .filter((t) => !PACKAGING_TOKEN_RE.test(t))
        .map(canonicalizeSemanticToken)
        .filter((t) => t.length > 1)
        .filter((t) => !NON_CRITICAL_SEMANTIC_TOKENS.has(t)),
    ),
  );
}

export async function buildSemanticKeywordInsights(
  prisma: PrismaService,
  tenantId: string,
  companyId: string,
  options?: { keyword?: string; days?: number; limit?: number },
) {
  const keywordRaw = String(options?.keyword || '').trim();
  const keywordTokens = extractSemanticTokens(keywordRaw);
  if (keywordRaw && keywordTokens.length === 0) {
    throw new BadRequestException('تعذر استخراج كلمة دلالية صالحة من قيمة البحث.');
  }

  const reqDays = Number(options?.days);
  const reqLimit = Number(options?.limit);
  const days = Number.isFinite(reqDays)
    ? Math.min(180, Math.max(7, Math.trunc(reqDays)))
    : 30;
  const limit = Number.isFinite(reqLimit)
    ? Math.min(300, Math.max(20, Math.trunc(reqLimit)))
    : 120;
  const from = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
  const probeToken = keywordTokens[0] || normalize(keywordRaw || '');

  const lineCandidates = await prisma.ocrInvoiceLine.findMany({
    where: {
      invoice: {
        tenantId,
        companyId,
        createdAt: { gte: from },
      },
      ...(probeToken
        ? {
            OR: [
              { rawName: { contains: probeToken, mode: 'insensitive' } },
              { nameAr: { contains: probeToken, mode: 'insensitive' } },
              { nameEn: { contains: probeToken, mode: 'insensitive' } },
              { item: { is: { nameAr: { contains: probeToken, mode: 'insensitive' } } } },
              { item: { is: { nameEn: { contains: probeToken, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      rawName: true,
      nameAr: true,
      nameEn: true,
      size: true,
      sizeUnit: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
      confidence: true,
      matchStatus: true,
      item: { select: { id: true, nameAr: true, nameEn: true, category: true } },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          createdAt: true,
          totalAmount: true,
          imageUrl: true,
          supplier: { select: { id: true, nameAr: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(2000, Math.max(limit * 6, 200)),
  });

  const suggestionCounts = new Map<string, number>();
  for (const line of lineCandidates) {
    const semanticSource =
      line.item?.nameAr
      || line.nameAr
      || line.rawName
      || line.nameEn
      || line.item?.nameEn
      || '';
    for (const token of extractSemanticTokens(semanticSource)) {
      suggestionCounts.set(token, (suggestionCounts.get(token) || 0) + 1);
    }
  }
  const keywordSuggestions = Array.from(suggestionCounts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  const semanticMatches = lineCandidates
    .filter((line) => {
      if (!keywordTokens.length) return false;
      const semanticSource =
        line.item?.nameAr
        || line.nameAr
        || line.rawName
        || line.nameEn
        || line.item?.nameEn
        || '';
      const lineTokens = new Set(extractSemanticTokens(semanticSource));
      return keywordTokens.every((token) => lineTokens.has(token));
    })
    .slice(0, limit);

  const itemIds = Array.from(new Set(
    semanticMatches.map((line) => line.item?.id).filter((x): x is string => !!x),
  ));
  const latestPriceRows = itemIds.length
    ? await prisma.ocrPriceHistory.findMany({
        where: { tenantId, companyId, itemId: { in: itemIds } },
        select: {
          itemId: true,
          price: true,
          invoiceDate: true,
          supplier: { select: { nameAr: true } },
        },
        orderBy: { invoiceDate: 'desc' },
        take: Math.min(6000, itemIds.length * 20),
      })
    : [];

  const latestPriceByItem = new Map<string, {
    price: number;
    invoiceDate: string;
    supplierName: string;
  }>();
  for (const row of latestPriceRows) {
    if (latestPriceByItem.has(row.itemId)) continue;
    const price = asNumber(row.price);
    if (price == null) continue;
    latestPriceByItem.set(row.itemId, {
      price,
      invoiceDate: toYmd(row.invoiceDate),
      supplierName: row.supplier?.nameAr || '—',
    });
  }

  const invoiceMap = new Map<string, {
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    supplierName: string;
    invoiceImageUrl: string | null;
    hasImage: boolean;
    matchedLines: number;
    matchedLinesTotal: number;
    invoiceTotal: number;
  }>();
  const itemMap = new Map<string, {
    itemId: string | null;
    itemName: string;
    category: string | null;
    suppliers: Set<string>;
    lineCount: number;
    invoiceIds: Set<string>;
    unitPriceSum: number;
    unitPriceCount: number;
    latestHistoryPrice: number | null;
    latestHistoryDate: string | null;
  }>();

  const lines = semanticMatches.map((line) => {
    const quantity = asNumber(line.quantity);
    const unitPrice = asNumber(line.unitPrice);
    const totalPrice = asNumber(line.totalPrice);
    const confidence = asNumber(line.confidence) ?? 0;
    const itemId = line.item?.id || null;
    const itemName = line.item?.nameAr || line.nameAr || line.rawName || '—';
    const supplierName = line.invoice.supplier?.nameAr || '—';
    const invoiceDate = line.invoice.invoiceDate || line.invoice.createdAt;
    const invoiceDateYmd = toYmd(invoiceDate);
    const history = itemId ? latestPriceByItem.get(itemId) : undefined;
    const historyPrice = history?.price ?? null;
    const historyDate = history?.invoiceDate ?? null;
    const priceDeltaPercent = unitPrice && historyPrice
      ? ((unitPrice - historyPrice) / historyPrice) * 100
      : null;

    if (!invoiceMap.has(line.invoice.id)) {
      invoiceMap.set(line.invoice.id, {
        invoiceId: line.invoice.id,
        invoiceNumber: line.invoice.invoiceNumber || '—',
        invoiceDate: invoiceDateYmd,
        supplierName,
        invoiceImageUrl: line.invoice.imageUrl || null,
        hasImage: !!line.invoice.imageUrl,
        matchedLines: 0,
        matchedLinesTotal: 0,
        invoiceTotal: asNumber(line.invoice.totalAmount) || 0,
      });
    }
    const invBucket = invoiceMap.get(line.invoice.id)!;
    invBucket.matchedLines += 1;
    invBucket.matchedLinesTotal += totalPrice || 0;

    const itemKey = itemId || `raw:${normalize(itemName).slice(0, 80)}`;
    if (!itemMap.has(itemKey)) {
      itemMap.set(itemKey, {
        itemId,
        itemName,
        category: line.item?.category || null,
        suppliers: new Set<string>(),
        lineCount: 0,
        invoiceIds: new Set<string>(),
        unitPriceSum: 0,
        unitPriceCount: 0,
        latestHistoryPrice: historyPrice,
        latestHistoryDate: historyDate,
      });
    }
    const itemBucket = itemMap.get(itemKey)!;
    itemBucket.suppliers.add(supplierName);
    itemBucket.lineCount += 1;
    itemBucket.invoiceIds.add(line.invoice.id);
    if (unitPrice != null) {
      itemBucket.unitPriceSum += unitPrice;
      itemBucket.unitPriceCount += 1;
    }

    return {
      lineId: line.id,
      invoiceId: line.invoice.id,
      invoiceNumber: line.invoice.invoiceNumber || '—',
      invoiceDate: invoiceDateYmd,
      invoiceImageUrl: line.invoice.imageUrl || null,
      hasImage: !!line.invoice.imageUrl,
      supplierId: line.invoice.supplier?.id || null,
      supplierName,
      itemId,
      itemName,
      rawName: line.rawName,
      quantity,
      unitPrice,
      totalPrice,
      confidence,
      matchStatus: line.matchStatus,
      size: line.size || null,
      sizeUnit: line.sizeUnit || null,
      historyPrice,
      historyDate,
      historySupplierName: history?.supplierName || null,
      priceDeltaPercent,
    };
  });

  const invoices = Array.from(invoiceMap.values())
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  const items = Array.from(itemMap.values())
    .map((row) => ({
      itemId: row.itemId,
      itemName: row.itemName,
      category: row.category,
      lineCount: row.lineCount,
      invoiceCount: row.invoiceIds.size,
      suppliers: Array.from(row.suppliers).slice(0, 5),
      avgUnitPrice: row.unitPriceCount ? row.unitPriceSum / row.unitPriceCount : 0,
      latestHistoryPrice: row.latestHistoryPrice,
      latestHistoryDate: row.latestHistoryDate,
    }))
    .sort((a, b) => b.lineCount - a.lineCount);

  const distinctSuppliers = new Set(lines.map((line) => line.supplierName));
  const avgUnitPrice = avg(lines.map((line) => line.unitPrice).filter((x): x is number => x != null));
  const avgConfidence = avg(lines.map((line) => line.confidence).filter((x): x is number => x != null));

  return {
    periodDays: days,
    range: {
      from: toYmd(from),
      to: toYmd(new Date()),
    },
    keyword: keywordRaw || null,
    normalizedKeyword: keywordTokens.join(' '),
    keywordTokens,
    keywordSuggestions,
    summary: {
      matchedLines: lines.length,
      invoicesCount: invoices.length,
      suppliersCount: distinctSuppliers.size,
      itemsCount: items.length,
      avgUnitPrice,
      avgConfidence,
    },
    lines,
    invoices,
    items,
  };
}

/**
 * خدمات الرؤى في OCR:
 * - تنبيهات الأسعار
 * - قواعد التصحيح
 * - لوحة تشغيل OCR (النجاح/الفشل/الأسباب/المحاولات/الأصناف/النماذج)
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toYmd } from '../common/utils/to-ymd.util';
import {
  buildSemanticKeywordInsights,
  extractSemanticTokens,
} from './ocr-semantic-keyword-insights.util';

type OcrAttemptTelemetry = {
  model?: string;
  outcome?: string;
  parseStage?: string;
  latencyMs?: number;
  error?: string;
};

type OcrRawExtraction = {
  modelAttempts?: OcrAttemptTelemetry[];
  qualityFlags?: unknown;
  extractionLatencyMs?: number;
  usedModel?: string;
  errorDetail?: string;
  supplier?: { confidence?: number };
};

type OcrFailureReasonKey =
  | 'parse'
  | 'schema'
  | 'low_signal'
  | 'network'
  | 'model_unavailable'
  | 'image'
  | 'runtime';

const PROCESSING_STATUSES = new Set(['queued', 'extracting']);
const UNMATCHED_LINE_STATUSES = new Set(['pending', 'new', 'rejected', '']);

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

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, x) => s + x, 0) / nums.length;
}

function percentile(nums: number[], p: number): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? 0;
}

function rate(part: number, total: number): number {
  if (!total) return 0;
  return (part / total) * 100;
}

function normalizeReasonText(...parts: Array<unknown>): string {
  return parts
    .map((x) => (typeof x === 'string' ? x : x != null ? String(x) : ''))
    .join(' ')
    .toLowerCase()
    .trim();
}


function classifyFailureReason(
  reasonText: string,
  options?: { weakSignal?: boolean; status?: string; lastAttempt?: OcrAttemptTelemetry | null },
): OcrFailureReasonKey {
  if (options?.weakSignal) return 'low_signal';
  if (reasonText.includes('json_parse_failed') || reasonText.includes('parse')) return 'parse';
  if (reasonText.includes('schema')) return 'schema';
  if (reasonText.includes('no_signal') || reasonText.includes('low-signal') || reasonText.includes('insufficient_actionable')) return 'low_signal';
  if (
    reasonText.includes('timeout')
    || reasonText.includes('network')
    || reasonText.includes('connection')
    || reasonText.includes('429')
    || reasonText.includes('408')
    || reasonText.includes('خطأ في الاتصال')
  ) return 'network';
  if (reasonText.includes('unavailable') || reasonText.includes('not found for api version') || reasonText.includes('not supported')) return 'model_unavailable';
  if (reasonText.includes('image') || reasonText.includes('file') || reasonText.includes('تعذّر قراءة الملف')) return 'image';
  const attemptOutcome = String(options?.lastAttempt?.outcome || '').toLowerCase();
  if (attemptOutcome === 'parse_failed') return 'parse';
  if (attemptOutcome === 'schema_failed') return 'schema';
  if (attemptOutcome === 'empty') return 'low_signal';
  if (attemptOutcome === 'unavailable' || attemptOutcome === 'blocked') return 'model_unavailable';
  if (attemptOutcome === 'http_error' || attemptOutcome === 'runtime_error') return 'network';
  if (options?.status === 'extraction_failed') return 'runtime';
  return 'runtime';
}

function hasUsefulInvoiceSignal(inv: {
  lines: Array<unknown>;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  subtotalAmount: unknown;
  totalAmount: unknown;
  vatAmount: unknown;
  rawExtraction: unknown;
}): boolean {
  if (inv.lines.length > 0) return true;
  if (inv.invoiceNumber || inv.invoiceDate) return true;
  if (inv.subtotalAmount != null || inv.totalAmount != null || inv.vatAmount != null) return true;
  const raw = inv.rawExtraction && typeof inv.rawExtraction === 'object'
    ? inv.rawExtraction as Record<string, unknown>
    : null;
  if (!raw) return false;
  const hasSupplier = !!(raw.supplier && typeof raw.supplier === 'object' && (raw.supplier as Record<string, unknown>).name);
  const hasHeader = !!(
    raw.invoiceNumber || raw.invoiceDate || raw.subtotalAmount || raw.totalAmount || raw.vatAmount
  );
  const hasItems = Array.isArray(raw.items) && raw.items.length > 0;
  return hasSupplier || hasHeader || hasItems;
}

@Injectable()
export class OcrInvoiceWorkflowInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPriceAlerts(tenantId: string, companyId: string) {
    if (!tenantId || !companyId) return [];
    const history = await this.prisma.ocrPriceHistory.findMany({
      where: { tenantId, companyId },
      include: {
        item: { select: { id: true, nameAr: true, category: true } },
        supplier: { select: { id: true, nameAr: true } },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    const byItem = new Map<string, typeof history>();
    for (const h of history) {
      if (!byItem.has(h.itemId)) byItem.set(h.itemId, []);
      byItem.get(h.itemId)!.push(h);
    }

    const alerts: Array<{
      itemId: string;
      itemName: string;
      category: string | null;
      latestPrice: number;
      latestSupplier: string;
      latestInvoiceId: string | null;
      latestInvoiceDate: Date;
      lowestPrice: number;
      lowestSupplier: string;
      lowestInvoiceId: string | null;
      lowestInvoiceDate: Date;
      averagePrice: number;
      priceIncreasePercent: number;
    }> = [];

    for (const [, entries] of byItem) {
      if (entries.length < 2) continue;
      const latest = entries[0];
      const latestPrice = Number(latest.price);
      const allPrices = entries.map((e) => Number(e.price));
      const lowestPrice = Math.min(...allPrices);
      const lowestEntry = entries.find((e) => Number(e.price) === lowestPrice)!;
      const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;

      const VAT_RATE = 0.15;
      const isVatArtifact =
        Math.abs(latestPrice / lowestPrice - (1 + VAT_RATE)) / (1 + VAT_RATE) < 0.02 ||
        Math.abs(lowestPrice / latestPrice - (1 + VAT_RATE)) / (1 + VAT_RATE) < 0.02;

      if (latestPrice > lowestPrice * 1.05 && !isVatArtifact) {
        alerts.push({
          itemId: latest.itemId,
          itemName: latest.item.nameAr,
          category: latest.item.category,
          latestPrice,
          latestSupplier: latest.supplier.nameAr,
          latestInvoiceId: latest.invoiceId ?? null,
          latestInvoiceDate: latest.invoiceDate,
          lowestPrice,
          lowestSupplier: lowestEntry.supplier.nameAr,
          lowestInvoiceId: lowestEntry.invoiceId ?? null,
          lowestInvoiceDate: lowestEntry.invoiceDate,
          averagePrice: Math.round(avgPrice * 100) / 100,
          priceIncreasePercent: Math.round(((latestPrice - lowestPrice) / lowestPrice) * 100),
        });
      }
    }

    return alerts.sort((a, b) => b.priceIncreasePercent - a.priceIncreasePercent);
  }

  async getCorrectionRules(tenantId: string, companyId: string) {
    return this.prisma.ocrCorrectionRule.findMany({
      where: { tenantId, companyId },
      include: { supplier: { select: { id: true, nameAr: true } } },
      orderBy: { occurrences: 'desc' },
    });
  }

  async updateCorrectionRule(tenantId: string, companyId: string, id: string, status: string) {
    const row = await this.prisma.ocrCorrectionRule.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('القاعدة غير موجودة.');
    return this.prisma.ocrCorrectionRule.update({
      where: { id },
      data: { status },
    });
  }

  async getOperationsDashboard(
    tenantId: string,
    companyId: string,
    options?: { days?: number },
  ) {
    const reqDays = Number(options?.days);
    const days = Number.isFinite(reqDays)
      ? Math.min(180, Math.max(7, Math.trunc(reqDays)))
      : 30;
    const from = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const invoices = await this.prisma.ocrInvoice.findMany({
      where: { tenantId, companyId, createdAt: { gte: from } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        extractionError: true,
        invoiceNumber: true,
        invoiceDate: true,
        subtotalAmount: true,
        totalAmount: true,
        vatAmount: true,
        rawExtraction: true,
        supplier: { select: { id: true, nameAr: true } },
        lines: {
          select: {
            id: true,
            rawName: true,
            confidence: true,
            matchStatus: true,
            item: { select: { id: true, nameAr: true, category: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const extractionLogs = await this.prisma.ocrExtractionLog.findMany({
      where: { tenantId, companyId, createdAt: { gte: from } },
      select: { entityType: true, confidence: true, resolvedToId: true, occurrences: true },
    });

    const statusCounts = new Map<string, number>();
    const failureReasonCounts = new Map<OcrFailureReasonKey, number>();
    const qualityFlagCounts = new Map<string, number>();
    const attemptsDistribution = new Map<number, number>();
    const modelStats = new Map<string, {
      attempts: number;
      successAttempts: number;
      latencies: number[];
      parseRepairCount: number;
      unavailableCount: number;
      emptyCount: number;
      parseFailedCount: number;
      finalWins: number;
    }>();
    const dailyStats = new Map<string, { total: number; success: number; failed: number }>();
    const itemStats = new Map<string, {
      itemId: string | null;
      nameAr: string;
      category: string | null;
      lineCount: number;
      invoiceIds: Set<string>;
      lowConfidenceLines: number;
      unmatchedLines: number;
      confidenceSum: number;
    }>();
    const semanticKeywordCounts = new Map<string, number>();
    const supplierStats = new Map<string, {
      supplierId: string | null;
      nameAr: string;
      totalInvoices: number;
      successInvoices: number;
      failedInvoices: number;
      confidenceSum: number;
      confidenceCount: number;
    }>();

    const attemptLatencyAll: number[] = [];
    const attemptsForSuccess: number[] = [];
    const successfulProfiles: Array<{
      lineCount: number;
      attempts: number;
      extractionLatencyMs: number;
    }> = [];

    let successCount = 0;
    let hardFailureCount = 0;
    let weakSignalCount = 0;
    let fallbackUsedCount = 0;
    let lowConfidenceLineCount = 0;
    let unmatchedLineCount = 0;
    let totalLineCount = 0;

    for (const inv of invoices) {
      const status = String(inv.status || '');
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      const dayKey = toYmd(inv.createdAt);
      if (!dailyStats.has(dayKey)) dailyStats.set(dayKey, { total: 0, success: 0, failed: 0 });
      const dayBucket = dailyStats.get(dayKey)!;
      dayBucket.total += 1;

      const raw = (inv.rawExtraction && typeof inv.rawExtraction === 'object'
        ? inv.rawExtraction
        : {}) as OcrRawExtraction;
      const attempts = Array.isArray(raw.modelAttempts) ? raw.modelAttempts : [];
      const qualityFlags = Array.isArray(raw.qualityFlags)
        ? raw.qualityFlags.filter((x): x is string => typeof x === 'string')
        : [];
      for (const flag of qualityFlags) {
        qualityFlagCounts.set(flag, (qualityFlagCounts.get(flag) || 0) + 1);
      }
      if (qualityFlags.includes('model_fallback_used')) fallbackUsedCount += 1;

      for (const att of attempts) {
        const model = (att.model || 'unknown').trim() || 'unknown';
        if (!modelStats.has(model)) {
          modelStats.set(model, {
            attempts: 0,
            successAttempts: 0,
            latencies: [],
            parseRepairCount: 0,
            unavailableCount: 0,
            emptyCount: 0,
            parseFailedCount: 0,
            finalWins: 0,
          });
        }
        const bucket = modelStats.get(model)!;
        bucket.attempts += 1;
        if (att.outcome === 'success') bucket.successAttempts += 1;
        const latency = asNumber(att.latencyMs);
        if (latency != null) {
          bucket.latencies.push(latency);
          attemptLatencyAll.push(latency);
        }
        if (att.parseStage === 'local_repair' || att.parseStage === 'ai_repair') bucket.parseRepairCount += 1;
        if (att.outcome === 'unavailable') bucket.unavailableCount += 1;
        if (att.outcome === 'empty') bucket.emptyCount += 1;
        if (att.outcome === 'parse_failed') bucket.parseFailedCount += 1;
      }
      const finalModel = typeof raw.usedModel === 'string' ? raw.usedModel.trim() : '';
      if (finalModel && modelStats.has(finalModel)) {
        modelStats.get(finalModel)!.finalWins += 1;
      }

      const processed = !PROCESSING_STATUSES.has(status);
      const usefulSignal = hasUsefulInvoiceSignal(inv);
      const consideredSuccess = processed && status !== 'extraction_failed' && usefulSignal;
      const consideredFailure = status === 'extraction_failed' || (processed && !consideredSuccess);

      if (consideredSuccess) {
        successCount += 1;
        dayBucket.success += 1;
        if (attempts.length > 0) {
          attemptsForSuccess.push(attempts.length);
          attemptsDistribution.set(attempts.length, (attemptsDistribution.get(attempts.length) || 0) + 1);
        }
        const lineCount = inv.lines.length;
        const extractionLatencyMs = asNumber(raw.extractionLatencyMs)
          ?? attempts
            .map((att) => asNumber(att.latencyMs))
            .filter((x): x is number => x != null)
            .reduce((s, x) => s + x, 0);
        if (lineCount > 0 && extractionLatencyMs > 0) {
          successfulProfiles.push({
            lineCount,
            attempts: Math.max(1, attempts.length),
            extractionLatencyMs,
          });
        }
      } else if (consideredFailure) {
        dayBucket.failed += 1;
        if (status === 'extraction_failed') hardFailureCount += 1;
        else weakSignalCount += 1;
        const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;
        const reasonText = normalizeReasonText(
          inv.extractionError,
          raw.errorDetail,
          qualityFlags.join(' '),
          lastAttempt?.error,
          lastAttempt?.outcome,
        );
        const reasonKey = classifyFailureReason(reasonText, {
          weakSignal: status !== 'extraction_failed',
          status,
          lastAttempt,
        });
        failureReasonCounts.set(reasonKey, (failureReasonCounts.get(reasonKey) || 0) + 1);
      }

      for (const line of inv.lines) {
        totalLineCount += 1;
        const semanticSource = line.item?.nameAr || String(line.rawName || '');
        for (const token of extractSemanticTokens(semanticSource)) {
          semanticKeywordCounts.set(token, (semanticKeywordCounts.get(token) || 0) + 1);
        }
        const itemKey = line.item?.id || `raw:${String(line.rawName || '').trim().toLowerCase().slice(0, 72)}`;
        const itemName = line.item?.nameAr || String(line.rawName || '—');
        if (!itemStats.has(itemKey)) {
          itemStats.set(itemKey, {
            itemId: line.item?.id || null,
            nameAr: itemName,
            category: line.item?.category || null,
            lineCount: 0,
            invoiceIds: new Set<string>(),
            lowConfidenceLines: 0,
            unmatchedLines: 0,
            confidenceSum: 0,
          });
        }
        const itemBucket = itemStats.get(itemKey)!;
        itemBucket.lineCount += 1;
        itemBucket.invoiceIds.add(inv.id);
        const conf = asNumber(line.confidence) ?? 0;
        itemBucket.confidenceSum += conf;
        if (conf > 0 && conf < 0.7) {
          itemBucket.lowConfidenceLines += 1;
          lowConfidenceLineCount += 1;
        }
        const matchStatus = String(line.matchStatus || '').toLowerCase();
        if (UNMATCHED_LINE_STATUSES.has(matchStatus)) {
          itemBucket.unmatchedLines += 1;
          unmatchedLineCount += 1;
        }
      }

      const supplierKey = inv.supplier?.id || `unmatched:${inv.id}`;
      if (!supplierStats.has(supplierKey)) {
        supplierStats.set(supplierKey, {
          supplierId: inv.supplier?.id || null,
          nameAr: inv.supplier?.nameAr || 'غير مربوط',
          totalInvoices: 0,
          successInvoices: 0,
          failedInvoices: 0,
          confidenceSum: 0,
          confidenceCount: 0,
        });
      }
      const supplierBucket = supplierStats.get(supplierKey)!;
      supplierBucket.totalInvoices += 1;
      if (consideredSuccess) supplierBucket.successInvoices += 1;
      if (consideredFailure) supplierBucket.failedInvoices += 1;
      const supplierConf = asNumber(raw.supplier?.confidence);
      if (supplierConf != null) {
        supplierBucket.confidenceSum += supplierConf;
        supplierBucket.confidenceCount += 1;
      }
    }

    const processedCount = invoices.length - (statusCounts.get('queued') || 0) - (statusCounts.get('extracting') || 0);
    const failedCount = hardFailureCount + weakSignalCount;

    const failureReasons = Array.from(failureReasonCounts.entries())
      .map(([reasonKey, count]) => ({
        reasonKey,
        count,
        rate: rate(count, failedCount),
      }))
      .sort((a, b) => b.count - a.count);

    const topQualityFlags = Array.from(qualityFlagCounts.entries())
      .map(([flag, count]) => ({ flag, count, rate: rate(count, invoices.length) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const models = Array.from(modelStats.entries())
      .map(([model, stats]) => ({
        model,
        attempts: stats.attempts,
        successAttempts: stats.successAttempts,
        failedAttempts: Math.max(0, stats.attempts - stats.successAttempts),
        successRate: rate(stats.successAttempts, stats.attempts),
        avgLatencyMs: avg(stats.latencies),
        p95LatencyMs: percentile(stats.latencies, 95),
        parseRepairCount: stats.parseRepairCount,
        unavailableCount: stats.unavailableCount,
        emptyCount: stats.emptyCount,
        parseFailedCount: stats.parseFailedCount,
        finalWins: stats.finalWins,
      }))
      .sort((a, b) => b.attempts - a.attempts);

    const attemptsToSuccess = Array.from(attemptsDistribution.entries())
      .map(([attempts, count]) => ({ attempts, count, rate: rate(count, attemptsForSuccess.length) }))
      .sort((a, b) => a.attempts - b.attempts);

    const itemInsights = Array.from(itemStats.values())
      .map((item) => ({
        itemId: item.itemId,
        nameAr: item.nameAr,
        category: item.category,
        lineCount: item.lineCount,
        invoiceCount: item.invoiceIds.size,
        lowConfidenceLines: item.lowConfidenceLines,
        unmatchedLines: item.unmatchedLines,
        unmatchedRate: rate(item.unmatchedLines, item.lineCount),
        avgConfidence: item.lineCount ? item.confidenceSum / item.lineCount : 0,
      }))
      .sort((a, b) => b.lineCount - a.lineCount)
      .slice(0, 30);

    const supplierInsights = Array.from(supplierStats.values())
      .map((supplier) => ({
        supplierId: supplier.supplierId,
        nameAr: supplier.nameAr,
        totalInvoices: supplier.totalInvoices,
        successInvoices: supplier.successInvoices,
        failedInvoices: supplier.failedInvoices,
        successRate: rate(supplier.successInvoices, supplier.totalInvoices),
        avgSupplierConfidence: supplier.confidenceCount
          ? supplier.confidenceSum / supplier.confidenceCount
          : 0,
      }))
      .sort((a, b) => b.totalInvoices - a.totalInvoices)
      .slice(0, 20);

    const dailyTrend = Array.from(dailyStats.entries())
      .map(([date, row]) => ({ date, ...row, successRate: rate(row.success, row.total) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const supplierLogs = extractionLogs.filter((x) => x.entityType === 'supplier');
    const itemLogs = extractionLogs.filter((x) => x.entityType === 'item');
    const supplierResolved = supplierLogs.reduce((s, x) => s + (x.resolvedToId ? x.occurrences : 0), 0);
    const supplierOccurrences = supplierLogs.reduce((s, x) => s + x.occurrences, 0);
    const itemResolved = itemLogs.reduce((s, x) => s + (x.resolvedToId ? x.occurrences : 0), 0);
    const itemOccurrences = itemLogs.reduce((s, x) => s + x.occurrences, 0);

    const nearTenItemProfiles = successfulProfiles.filter((row) => row.lineCount >= 8 && row.lineCount <= 12);
    const baselineProfiles = nearTenItemProfiles.length > 0
      ? nearTenItemProfiles
      : successfulProfiles;
    const tenItemsExpectedMs = baselineProfiles.length > 0
      ? avg(baselineProfiles.map((row) => row.extractionLatencyMs))
      : (avg(attemptLatencyAll) * Math.max(1, avg(attemptsForSuccess)));
    const tenItemsWasteRate = baselineProfiles.length > 0
      ? rate(
          baselineProfiles.reduce((s, row) => s + Math.max(0, row.attempts - 1), 0),
          baselineProfiles.reduce((s, row) => s + Math.max(1, row.attempts), 0),
        )
      : 0;
    const tenItemsWasteSeconds = (tenItemsExpectedMs * (tenItemsWasteRate / 100)) / 1000;
    const topSemanticKeywords = Array.from(semanticKeywordCounts.entries())
      .map(([keyword, count]) => ({ keyword, count, rate: rate(count, totalLineCount) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    return {
      periodDays: days,
      range: {
        from: toYmd(from),
        to: toYmd(new Date()),
      },
      summary: {
        totalInvoices: invoices.length,
        processedInvoices: Math.max(0, processedCount),
        successCount,
        failedCount,
        hardFailureCount,
        weakSignalCount,
        queuedCount: statusCounts.get('queued') || 0,
        extractingCount: statusCounts.get('extracting') || 0,
        pendingReviewCount: statusCounts.get('pending_review') || 0,
        confirmedCount: statusCounts.get('confirmed') || 0,
        rejectedCount: statusCounts.get('rejected') || 0,
        successRate: rate(successCount, processedCount),
        failureRate: rate(failedCount, processedCount),
        avgAttemptsToSuccess: avg(attemptsForSuccess),
        p95AttemptsToSuccess: percentile(attemptsForSuccess, 95),
        fallbackUsedCount,
        fallbackUsedRate: rate(fallbackUsedCount, processedCount),
        avgAttemptLatencyMs: avg(attemptLatencyAll),
        p95AttemptLatencyMs: percentile(attemptLatencyAll, 95),
        tenItemsExpectedSeconds: tenItemsExpectedMs / 1000,
        tenItemsWasteRate,
        tenItemsWasteSeconds,
        tenItemsSampleSize: baselineProfiles.length,
        lowConfidenceLineCount,
        unmatchedLineCount,
      },
      attemptsToSuccess,
      failureReasons,
      topQualityFlags,
      models,
      dailyTrend,
      itemInsights,
      supplierInsights,
      topSemanticKeywords,
      matching: {
        supplierLogsCount: supplierLogs.length,
        supplierResolutionRate: rate(supplierResolved, supplierOccurrences),
        supplierAvgConfidence: avg(supplierLogs.map((x) => x.confidence || 0)),
        itemLogsCount: itemLogs.length,
        itemResolutionRate: rate(itemResolved, itemOccurrences),
        itemAvgConfidence: avg(itemLogs.map((x) => x.confidence || 0)),
      },
    };
  }

  async getSemanticKeywordInsights(
    tenantId: string,
    companyId: string,
    options?: { keyword?: string; days?: number; limit?: number },
  ) {
    return buildSemanticKeywordInsights(this.prisma, tenantId, companyId, options);
  }
}

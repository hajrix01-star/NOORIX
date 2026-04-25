import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getGeminiApiKey, getGeminiModel } from '../config/gemini.config';
import { normalize } from './ocr-normalize.util';
import { findBestMatch, classifyConfidence, combinedSimilarity, deepSimilarity } from './ocr-match.util';
import { ExtractInvoiceDto } from './dto/extract-invoice.dto';
import { CreateOcrSupplierDto } from './dto/create-ocr-supplier.dto';
import { CreateOcrItemDto } from './dto/create-ocr-item.dto';
import { SaveInvoiceDto } from './dto/save-invoice.dto';
import { CreateInvoiceDto } from '../invoice/dto/create-invoice.dto';
import { InvoiceService } from '../invoice/invoice.service';
import { hasPermission, PERMISSIONS } from '../auth/constants/permissions';
import { SubmitOcrInvoiceDto } from './dto/submit-ocr.dto';
import { OcrInvoiceStatus, OCR_REVIEW_QUEUE_STATUSES } from './ocr-invoice-status';

// ─── Math Validation ─────────────────────────────────────────────────────────

interface MathValidationResult {
  valid: boolean;
  warning?: string;
  suggestedQuantity?: number;
  suggestedUnitPrice?: number;
}

function validateItemMath(
  quantity?: number,
  unitPrice?: number,
  totalPrice?: number,
): MathValidationResult {
  if (!quantity || !unitPrice || !totalPrice) return { valid: true };

  const computed = quantity * unitPrice;
  const tolerance = Math.max(computed, totalPrice) * 0.03; // 3% هامش

  if (Math.abs(computed - totalPrice) <= tolerance) return { valid: true };

  // totalPrice هو المرجع الأوثق — احسب البديل
  const inferredQty = totalPrice / unitPrice;
  const inferredPrice = totalPrice / quantity;

  // إذا كانت الكمية المستنتجة عدداً صحيحاً (أو قريباً منه) → اقترح تصحيحها
  if (inferredQty > 0 && Math.abs(inferredQty - Math.round(inferredQty)) < 0.05) {
    return {
      valid: false,
      warning: `${quantity} × ${unitPrice} = ${computed.toFixed(2)} ≠ ${totalPrice} — الكمية المحتملة: ${Math.round(inferredQty)}`,
      suggestedQuantity: Math.round(inferredQty),
    };
  }

  return {
    valid: false,
    warning: `${quantity} × ${unitPrice} = ${computed.toFixed(2)} ≠ ${totalPrice} — السعر المحتمل: ${inferredPrice.toFixed(2)}`,
    suggestedUnitPrice: Math.round(inferredPrice * 100) / 100,
  };
}

/**
 * يتحقق من توافق مجموع الأصناف مع إجمالي الفاتورة.
 *
 * منطق الفواتير الضريبية السعودية:
 *   أسعار الأصناف = بدون ضريبة (subtotal)
 *   subtotal + VAT = grand total (totalAmount)
 *
 * ترتيب المقارنة:
 *   1. itemsSum ≈ subtotalAmount          (إذا استُخرج المجموع قبل الضريبة)
 *   2. itemsSum ≈ totalAmount - vatAmount  (إذا لم يكن subtotalAmount متوفراً)
 *   3. itemsSum ≈ totalAmount              (فواتير بدون ضريبة منفصلة)
 */
function validateInvoiceTotals(
  itemsTotal: number,
  totalAmount?: number,
  vatAmount?: number,
  subtotalAmount?: number,
): { valid: boolean; warning?: string; vatAdjusted: boolean } {
  if (!totalAmount || itemsTotal === 0) return { valid: true, vatAdjusted: false };

  const T = 0.05; // هامش 5%

  // 1. قارن بـ subtotalAmount (المجموع قبل الضريبة) إن وُجد
  if (subtotalAmount && subtotalAmount > 0) {
    const tol = subtotalAmount * T;
    if (Math.abs(itemsTotal - subtotalAmount) <= tol) return { valid: true, vatAdjusted: true };
    return {
      valid: false,
      vatAdjusted: true,
      warning: `مجموع الأصناف ${itemsTotal.toFixed(2)} ≠ المجموع قبل الضريبة ${subtotalAmount.toFixed(2)}`,
    };
  }

  // 2. اطرح الضريبة من الإجمالي وقارن
  if (vatAmount && vatAmount > 0) {
    const expectedSubtotal = totalAmount - vatAmount;
    const tol = Math.max(expectedSubtotal, itemsTotal) * T;
    if (Math.abs(itemsTotal - expectedSubtotal) <= tol) return { valid: true, vatAdjusted: true };
    // تحقق أيضاً من الإجمالي الكلي (بعض الفواتير تضم الضريبة في السطور)
    if (Math.abs(itemsTotal - totalAmount) <= totalAmount * T) return { valid: true, vatAdjusted: false };
    return {
      valid: false,
      vatAdjusted: true,
      warning: `مجموع الأصناف ${itemsTotal.toFixed(2)} ≠ المجموع قبل الضريبة المحسوب (${totalAmount} - ${vatAmount} = ${expectedSubtotal.toFixed(2)})`,
    };
  }

  // 3. لا ضريبة منفصلة — قارن بالإجمالي مباشرة
  const tol = totalAmount * T;
  if (Math.abs(itemsTotal - totalAmount) <= tol) return { valid: true, vatAdjusted: false };
  return {
    valid: false,
    vatAdjusted: false,
    warning: `مجموع الأصناف ${itemsTotal.toFixed(2)} لا يتطابق مع إجمالي الفاتورة ${totalAmount}`,
  };
}

// ─── Name & Size Parsing Utilities ───────────────────────────────────────────

const SIZE_UNITS = ['kg', 'g', 'gr', 'gm', 'ml', 'l', 'ltr', 'liter', 'pcs', 'pc', 'كجم', 'كيلو', 'جرام', 'مل', 'لتر', 'حبة', 'علبة', 'كيس'];
const UNITS_PATTERN = SIZE_UNITS.join('|');

// يتعرف على أنماط الحجم المختلفة:
//   "4x2.5-kg"  "4x2.5 kg"  "2.5-kg"  "2.5 kg"  "500ml"  "700g"
//   "4x1-L"     "6x500ml"
const PACK_SIZE_REGEX = new RegExp(
  `\\(?(\\d+)\\s*[xX×]\\s*(\\d+(?:[.,]\\d+)?)\\s*-?\\s*(${UNITS_PATTERN})\\s*-?[A-Z]?\\)?`,
  'gi',
);
const SIMPLE_SIZE_REGEX = new RegExp(
  `\\(?(\\d+(?:[.,]\\d+)?)\\s*-?\\s*(${UNITS_PATTERN})\\.?\\)?(?=\\s|$|[,)x×])`,
  'gi',
);

const ARABIC_RANGE = /[\u0600-\u06FF]/;
const LATIN_RANGE  = /[A-Za-z]/;

/** يقسّم الاسم المختلط إلى جزء عربي وجزء إنجليزي (يحذف الأرقام والرموز) */
function splitBilingualName(name: string): { nameAr: string | null; nameEn: string | null } {
  if (!name) return { nameAr: null, nameEn: null };
  const hasAr = ARABIC_RANGE.test(name);
  const hasEn = LATIN_RANGE.test(name);
  if (!hasAr && !hasEn) return { nameAr: name, nameEn: null };
  if (hasAr && !hasEn)  return { nameAr: name, nameEn: null };
  if (!hasAr && hasEn)  return { nameAr: null, nameEn: name };

  // اسم مختلط — استخرج كل كلمة بحسب لغتها (تجاهل tokens الأرقام/الرموز)
  const arTokens: string[] = [];
  const enTokens: string[] = [];
  name.split(/\s+/).forEach((token) => {
    const cleanToken = token.replace(/[()[\]{}_\-.,]/g, '');
    if (!cleanToken) return;
    if (ARABIC_RANGE.test(cleanToken)) arTokens.push(cleanToken);
    else if (LATIN_RANGE.test(cleanToken)) enTokens.push(cleanToken);
    // tokens بدون حروف (أرقام فقط) تُهمل
  });
  return {
    nameAr: arTokens.length ? arTokens.join(' ') : null,
    nameEn: enTokens.length ? enTokens.join(' ') : null,
  };
}

/**
 * يستخرج الحجم ووحدته من اسم الصنف ويُرجع الاسم مُنظَّفاً.
 * يتعامل مع:
 *   "4x2.5-kg"  →  size=2.5, sizeUnit=kg  (حجم العبوة الواحدة)
 *   "6x500ml"   →  size=500, sizeUnit=ml
 *   "2.5-kg"    →  size=2.5, sizeUnit=kg
 *   "700g"      →  size=700, sizeUnit=g
 */
function extractSizeFromName(name: string): { cleanName: string; size: string | null; sizeUnit: string | null } {
  if (!name) return { cleanName: name, size: null, sizeUnit: null };

  let cleanName = name;
  let size: string | null = null;
  let sizeUnit: string | null = null;

  // أولاً: نمط الكراتين/الطرود NxM-UNIT (e.g. "4x2.5-kg", "6x500ml")
  PACK_SIZE_REGEX.lastIndex = 0;
  const packMatch = PACK_SIZE_REGEX.exec(name);
  if (packMatch) {
    size = packMatch[2].replace(',', '.');
    sizeUnit = packMatch[3].toLowerCase();
    cleanName = name.replace(packMatch[0], ' ').replace(/\s{2,}/g, ' ').trim();
    return { cleanName, size, sizeUnit };
  }

  // ثانياً: نمط بسيط M-UNIT أو M UNIT (e.g. "2.5-kg", "500ml", "700 g")
  SIMPLE_SIZE_REGEX.lastIndex = 0;
  const simpleMatch = SIMPLE_SIZE_REGEX.exec(name);
  if (simpleMatch) {
    size = simpleMatch[1].replace(',', '.');
    sizeUnit = simpleMatch[2].toLowerCase();
    cleanName = name.replace(simpleMatch[0], ' ').replace(/\s{2,}/g, ' ').trim();
    return { cleanName, size, sizeUnit };
  }

  return { cleanName: name.trim(), size: null, sizeUnit: null };
}

/**
 * يُطبّع اسم صنف للمقارنة الذكية — يُزيل الحجم ويستخرج الاسمين العربي والإنجليزي.
 * يُستخدم لتسوية أسماء DB القديمة التي قد تحتوي على اسم مختلط فوضوي.
 */
function normalizeItemForSearch(rawName: string): { ar: string; en: string; combined: string } {
  const { cleanName } = extractSizeFromName(rawName);
  const { nameAr, nameEn } = splitBilingualName(cleanName);
  const ar = nameAr?.trim() ?? '';
  const en = nameEn?.trim() ?? '';
  const combined = [ar, en].filter(Boolean).join(' ');
  return { ar, en, combined };
}

/**
 * بحث ذكي في قائمة أصناف — يقارن الاسم المستخرج مع:
 *   1. الاسم العربي المُستخرج من DB (بعد تنظيف الجزء الإنجليزي)
 *   2. الاسم الإنجليزي المُستخرج من DB
 *   3. الاسم الكامل في DB
 *   4. الأسماء البديلة (aliases)
 * يأخذ أعلى نسبة تشابه.
 */
function findBestItemMatch(
  query: string,
  candidates: Array<{ id: string; nameAr: string; nameEn?: string | null; hasSizes: boolean; aliases: { alias: string }[] }>,
): { item: typeof candidates[0]; score: number } | null {
  if (!query || candidates.length === 0) return null;

  const { ar: qAr, en: qEn, combined: qCombined } = normalizeItemForSearch(query);
  const searchTerms = [query, qAr, qEn, qCombined].filter(Boolean);

  let best: { item: typeof candidates[0]; score: number } | null = null;

  for (const candidate of candidates) {
    const { ar: cAr, en: cEn, combined: cCombined } = normalizeItemForSearch(candidate.nameAr);
    const candidateNames = [
      candidate.nameAr,
      cAr, cEn, cCombined,
      candidate.nameEn,
      ...candidate.aliases.map((a) => a.alias),
    ].filter((n): n is string => !!n);

    let maxScore = 0;
    for (const sq of searchTerms) {
      if (!sq) continue;
      for (const cn of candidateNames) {
        if (!cn) continue;
        // تجاهل مقارنات أقل من 2 حروف
        if (sq.length < 2 || cn.length < 2) continue;
        const s = Math.max(
          combinedSimilarity(sq, cn),
          deepSimilarity(sq, cn),
        );
        if (s > maxScore) maxScore = s;
      }
    }

    if (maxScore === 1) return { item: candidate, score: 1 };
    if (!best || maxScore > best.score) best = { item: candidate, score: maxScore };
  }

  return best;
}


// ─── Gemini Model Fallback Chain ─────────────────────────────────────────────
// إذا لم يكن النموذج المُعيّن متاحاً، يجرب النظام النماذج بالترتيب تلقائياً
const GEMINI_FALLBACK_CHAIN = [
  { model: 'gemini-2.5-flash',     version: 'v1beta' },
  { model: 'gemini-2.0-flash-exp', version: 'v1beta' },
  { model: 'gemini-1.5-flash',     version: 'v1'     },
  { model: 'gemini-1.5-pro',       version: 'v1'     },
  { model: 'gemini-pro-vision',    version: 'v1beta' },
  // حسابات قديمة فقط — غالباً 404 للمستخدمين الجدد
  { model: 'gemini-2.0-flash',     version: 'v1beta' },
];

function buildGeminiUrl(model: string, version: string): string {
  return `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`;
}

/** يُرجع قائمة النماذج للمحاولة: النموذج المُعيّن أولاً ثم سلسلة الـ fallback */
function getGeminiModelsToTry(): Array<{ model: string; version: string }> {
  const configured = getGeminiModel();
  const version = /^gemini-1\.[05]/.test(configured) ? 'v1' : 'v1beta';
  const chain = GEMINI_FALLBACK_CHAIN.filter((m) => m.model !== configured);
  return [{ model: configured, version }, ...chain];
}

function extractJson<T = Record<string, unknown>>(text: string): T | null {
  const raw = (text || '').trim();
  if (!raw) return null;

  // 1. جرب البحث عن آخر كتلة JSON في النص (لأن gemini-2.5 يضع thinking أولاً)
  const allJsonBlocks: string[] = [];

  // استخرج من كتل markdown
  const mdMatches = raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/g);
  for (const m of mdMatches) allJsonBlocks.push(m[1].trim());

  // استخرج كل {} كبرى في النص
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '{') {
      let depth = 0, end = -1;
      for (let j = i; j < raw.length; j++) {
        if (raw[j] === '{') depth++;
        else if (raw[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
      }
      if (end !== -1) {
        allJsonBlocks.push(raw.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    i++;
  }

  // 2. جرّب كل كتلة — ابدأ من الأخيرة (آخر JSON هو الجواب في نماذج التفكير)
  for (const block of [...allJsonBlocks].reverse()) {
    try {
      const parsed = JSON.parse(block) as T;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch { /* جرب التالية */ }
  }

  return null;
}

interface GeminiExtractedItem {
  name?: string;       // الاسم الكامل كما في الفاتورة (Gemini يُرجع هذا فقط)
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  confidence?: number;
  // هذه الحقول تُضاف بعد الاستخراج في enrichExtraction (ليس من Gemini)
  nameAr?: string;
  nameEn?: string;
  size?: string;
  sizeUnit?: string;
  cleanName?: string;
}

interface GeminiExtractedInvoice {
  supplier?: { name?: string; confidence?: number };
  vatNumber?: { value?: string; confidence?: number };
  invoiceNumber?: { value?: string; confidence?: number };
  invoiceDate?: { value?: string; confidence?: number };
  subtotalAmount?: { value?: number; confidence?: number }; // المجموع قبل الضريبة
  totalAmount?: { value?: number; confidence?: number };    // الإجمالي شامل الضريبة
  vatAmount?: { value?: number; confidence?: number };
  items?: GeminiExtractedItem[];
}

const OCR_EXTRACTION_PROMPT = `You are an expert invoice data extraction system specializing in Arabic/Saudi tax invoices. Extract ALL data and return ONLY a raw JSON object.

OUTPUT FORMAT (no markdown, no explanation — start with { end with }):
{"supplier":{"name":"seller name","confidence":0.95},"vatNumber":{"value":"tax registration number","confidence":0.9},"invoiceNumber":{"value":"invoice number","confidence":0.95},"invoiceDate":{"value":"YYYY-MM-DD","confidence":0.95},"subtotalAmount":{"value":515.85,"confidence":0.98},"vatAmount":{"value":77.30,"confidence":0.98},"totalAmount":{"value":593.22,"confidence":0.98},"items":[{"name":"item name as printed","quantity":5,"unitPrice":60.00,"totalPrice":300.00,"confidence":0.90}]}

SAUDI VAT INVOICE STRUCTURE — CRITICAL:
Saudi tax invoices have THREE separate totals at the bottom:
  1. subtotalAmount (المجموع قبل الضريبة / Taxable Amount) — sum of all line items BEFORE VAT
  2. vatAmount (ضريبة القيمة المضافة / VAT 15%) — the tax amount
  3. totalAmount (الإجمالي شامل الضريبة / Total with VAT) — subtotalAmount + vatAmount
ALWAYS extract all three. Item prices are EXCLUDING VAT.
Verify: subtotalAmount + vatAmount ≈ totalAmount

MATH RULES FOR LINE ITEMS:
- Every item: totalPrice = quantity × unitPrice (within 1%)
- If conflict: totalPrice printed on invoice is truth → recalculate the other value
- "12x1-L" or "12x1L" = quantity:12, size:1L — NOT quantity:0.5
- "6x500ml" = quantity:6, size:500ml
- Carton/pack quantities like "24PCS" = quantity:24

GENERAL RULES:
- Return ONLY valid JSON starting with {
- confidence 0.0–1.0 per field
- null for unreadable fields
- Keep item names exactly as printed (Arabic, English, or mixed)
- Date: YYYY-MM-DD format
- Numbers only (no currency symbols, no commas)
- Extract ALL line items — do not skip any`;



export type OcrSaveInvoiceCaller = {
  userId: string;
  role?: string;
  permissions?: string[];
};

@Injectable()
export class OcrInvoicesService {
  private readonly logger = new Logger(OcrInvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  // ─── Gemini Vision OCR ────────────────────────────────────────────────────

  async extractInvoice(tenantId: string, companyId: string, dto: ExtractInvoiceDto) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new BadRequestException('Gemini API key not configured');

    const mimeType = dto.mimeType || 'image/jpeg';
    const modelsToTry = getGeminiModelsToTry();

    const requestBody = {
      contents: [{
        parts: [
          { text: OCR_EXTRACTION_PROMPT },
          { inlineData: { mimeType, data: dto.imageBase64 } },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      // تعطيل كل فلاتر السلامة — الفواتير لا تحتوي محتوى ضار
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',         threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',        threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',  threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT',  threshold: 'BLOCK_NONE' },
      ],
    };

    type GeminiRaw = {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      error?: { message?: string; code?: number };
    };

    // ── يُجرّب النماذج بالترتيب حتى ينجح أحدها ─────────────────────────
    for (const { model, version } of modelsToTry) {
      const url = `${buildGeminiUrl(model, version)}?key=${apiKey}`;

      let rawJson: GeminiRaw | null = null;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        rawJson = await res.json().catch(() => null) as GeminiRaw | null;

        if (!res.ok) {
          const errMsg = rawJson?.error?.message || res.statusText;
          const isUnavailable =
            res.status === 404 ||
            errMsg.toLowerCase().includes('not found') ||
            errMsg.toLowerCase().includes('not supported') ||
            errMsg.toLowerCase().includes('is not found for api version');

          if (isUnavailable) {
            this.logger.warn(`Gemini model "${model}" unavailable → trying next in chain`);
            continue; // جرّب النموذج التالي
          }

          this.logger.error(`Gemini error ${res.status} (${model}): ${errMsg}`);
          throw new BadRequestException(`فشل الاستخراج من Gemini: ${errMsg}`);
        }

        // ── نجح الطلب ────────────────────────────────────────────────────
        const candidate = rawJson?.candidates?.[0];

        // فحص حظر المحتوى (safety / prompt feedback)
        const blockReason =
          (rawJson as { promptFeedback?: { blockReason?: string } })?.promptFeedback?.blockReason
          || candidate?.finishReason;

        if (blockReason === 'SAFETY' || blockReason === 'RECITATION' || blockReason === 'OTHER') {
          this.logger.warn(`Gemini blocked (${model}): ${blockReason} → trying next model`);
          continue;
        }

        const parts = candidate?.content?.parts || [];
        const text = parts.map((p) => p.text || '').join('\n').trim();

        this.logger.log(`Gemini OK (${model}) | finish=${candidate?.finishReason} | parts=${parts.length} | textLen=${text.length} | text[500]=${text.substring(0, 500)}`);

        if (!text) {
          this.logger.warn(`Gemini returned empty text (${model}) → trying next model`);
          continue;
        }

        const extracted = extractJson<GeminiExtractedInvoice>(text);
        if (!extracted) {
          this.logger.error(`Gemini parse failed (${model}). textLen=${text.length} text(1000)=${text.substring(0, 1000)}`);
          return {
            parseError: true,
            usedModel: model,
            rawText: text.substring(0, 800),
            errorDetail: 'JSON parse failed — Gemini returned text but no valid JSON found',
            supplier: null, supplierMatch: null,
            vatNumber: null, invoiceNumber: null,
            invoiceDate: null, totalAmount: null,
            vatAmount: null, items: [],
          };
        }

        this.logger.log(`Gemini extracted OK (${model}): supplier=${extracted.supplier?.name} items=${extracted.items?.length}`);

        // enrichExtraction محمي بـ try/catch — لا يُفسد النتيجة
        try {
          return await this.enrichExtraction(tenantId, companyId, extracted);
        } catch (enrichErr) {
          this.logger.error(`enrichExtraction failed: ${(enrichErr as Error).message}. Returning raw extraction.`);
          return {
            supplier: extracted.supplier,
            supplierMatch: null,
            vatNumber: extracted.vatNumber,
            invoiceNumber: extracted.invoiceNumber,
            invoiceDate: extracted.invoiceDate,
            totalAmount: extracted.totalAmount,
            vatAmount: extracted.vatAmount,
            items: (extracted.items || []).map((item) => ({ ...item, itemMatch: null })),
            enrichError: (enrichErr as Error).message,
          };
        }

      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        this.logger.error(`Gemini network/runtime error (${model}): ${(err as Error).message} ${(err as Error).stack}`);
        throw new BadRequestException(`خطأ في الاتصال بـ Gemini: ${(err as Error).message}`);
      }
    }

    throw new BadRequestException('لا يوجد نموذج Gemini متاح. تحقق من GEMINI_API_KEY.');
  }

  private async enrichExtraction(tenantId: string, companyId: string, extracted: GeminiExtractedInvoice) {
    const suppliers = await this.prisma.ocrSupplier.findMany({
      where: { tenantId, companyId },
      include: { aliases: true },
    });

    const items = await this.prisma.ocrItem.findMany({
      where: { tenantId, companyId },
      include: { aliases: true },
    });

    // مطابقة المورد
    let supplierMatch: { id: string; nameAr: string; score: number; status: string } | null = null;

    const supplierName = extracted.supplier?.name;
    if (supplierName) {
      // تحقق من الرقم الضريبي أولاً
      const vatVal = extracted.vatNumber?.value;
      const vatConf = extracted.vatNumber?.confidence ?? 0;
      if (vatVal && vatConf >= 0.9) {
        const byVat = suppliers.find((s) => s.taxNumber && normalize(s.taxNumber) === normalize(vatVal));
        if (byVat) {
          supplierMatch = { id: byVat.id, nameAr: byVat.nameAr, score: 1, status: 'auto' };
        }
      }

      if (!supplierMatch) {
        const result = findBestMatch(
          supplierName,
          suppliers,
          (s) => s.nameAr,
          (s) => s.aliases.map((a) => a.alias),
        );
        if (result) {
          const status = classifyConfidence(result.score);
          if (status !== 'new') {
            supplierMatch = {
              id: (result.item as { id: string }).id,
              nameAr: (result.item as { nameAr: string }).nameAr,
              score: result.score,
              status: status === 'auto' ? 'auto' : 'review',
            };
          }
        }
      }

      // سجّل في extraction log
      await this.logExtraction(tenantId, companyId, 'supplier', supplierName, supplierMatch);
    }

    // مطابقة الأصناف — المطابقة على الاسم الأساسي بدون الحجم
    const matchedItems = await Promise.all(
      (extracted.items || []).map(async (item) => {
        if (!item.name) return { ...item, itemMatch: null };

        // 1. استخرج الحجم من الاسم الكامل
        const { cleanName, size, sizeUnit } = extractSizeFromName(item.name);

        // 2. قسّم الاسم إلى عربي وإنجليزي (بدون الحجم)
        const { nameAr, nameEn } = splitBilingualName(cleanName);

        // أضف الحقول المُستخرجة للصنف
        const enrichedItem = { ...item, nameAr, nameEn, size, sizeUnit, cleanName };

        // استخدم nameAr أو nameEn أو الاسم المُنظَّف للمطابقة
        const matchName = nameAr || nameEn || cleanName;

        // البحث الذكي يقارن ضد الاسم العربي والإنجليزي المستخرجَين من أسماء DB أيضاً
        const bestResult = findBestItemMatch(matchName, items);

        let itemMatch: { id: string; nameAr: string; nameEn?: string | null; score: number; status: string; hasSizes: boolean } | null = null;
        if (bestResult) {
          const status = classifyConfidence(bestResult.score);
          if (status !== 'new') {
            itemMatch = {
              id: bestResult.item.id,
              nameAr: bestResult.item.nameAr,
              nameEn: bestResult.item.nameEn,
              hasSizes: bestResult.item.hasSizes,
              score: bestResult.score,
              status: status === 'auto' ? 'auto' : 'review',
            };
          }
        }

        // تسجيل بالاسم الأساسي (بدون الحجم)
        await this.logExtraction(tenantId, companyId, 'item', matchName, itemMatch, supplierMatch?.id);

        // إذا كان الصنف له حجم — حدّث has_sizes في الكتالوج
        if (itemMatch && size) {
          await this.prisma.ocrItem.update({
            where: { id: itemMatch.id },
            data: { hasSizes: true },
          }).catch(() => { /* تجاهل خطأ التحديث */ });
        }

        return { ...enrichedItem, itemMatch };
      }),
    );

    // ── التحقق الرياضي + Price Intelligence ──────────────────────────────────

    // سعر التاريخ — جلب آخر 90 يوم لكل صنف متطابق
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const enrichedWithWarnings = await Promise.all(
      matchedItems.map(async (item) => {
        // 1. تحقق رياضي
        const mathResult = validateItemMath(item.quantity, item.unitPrice, item.totalPrice);

        // 2. Price Intelligence — فقط للأصناف المطابقة والمسعّرة
        let priceWarning: { avg: number; deviation: number; lastPrice: number } | null = null;
        if (item.itemMatch?.id && item.unitPrice && item.unitPrice > 0) {
          const history = await this.prisma.ocrPriceHistory.findMany({
            where: {
              tenantId,
              companyId,
              itemId: item.itemMatch.id,
              invoiceDate: { gte: ninetyDaysAgo },
            },
            orderBy: { invoiceDate: 'desc' },
            take: 10,
          });

          if (history.length >= 2) {
            const avg = history.reduce((s, h) => s + Number(h.price), 0) / history.length;
            const deviation = Math.abs(item.unitPrice - avg) / avg;
            if (deviation > 0.25) { // >25% انحراف
              priceWarning = {
                avg: Math.round(avg * 100) / 100,
                deviation: Math.round(deviation * 100),
                lastPrice: Number(history[0].price),
              };
            }
          }
        }

        return {
          ...item,
          mathWarning: mathResult.valid ? undefined : {
            message: mathResult.warning,
            suggestedQuantity: mathResult.suggestedQuantity,
            suggestedUnitPrice: mathResult.suggestedUnitPrice,
          },
          priceWarning: priceWarning ?? undefined,
        };
      }),
    );

    // تحقق من مجموع الأصناف مع مراعاة الضريبة
    const itemsSum = enrichedWithWarnings.reduce((s, i) => s + (i.totalPrice || 0), 0);
    const invoiceTotalValidation = validateInvoiceTotals(
      itemsSum,
      extracted.totalAmount?.value,
      extracted.vatAmount?.value,
      extracted.subtotalAmount?.value,
    );

    return {
      supplier: extracted.supplier,
      supplierMatch,
      vatNumber: extracted.vatNumber,
      invoiceNumber: extracted.invoiceNumber,
      invoiceDate: extracted.invoiceDate,
      subtotalAmount: extracted.subtotalAmount,
      totalAmount: extracted.totalAmount,
      vatAmount: extracted.vatAmount,
      items: enrichedWithWarnings,
      invoiceTotalWarning: invoiceTotalValidation.valid ? undefined : invoiceTotalValidation.warning,
      vatAdjusted: invoiceTotalValidation.vatAdjusted, // للـ frontend: يعلمه أن المقارنة أخذت الضريبة بعين الاعتبار
    };
  }

  private async logExtraction(
    tenantId: string,
    companyId: string,
    entityType: string,
    extractedText: string,
    resolved: { id: string; nameAr: string; score: number } | null,
    supplierId?: string,
  ) {
    const normText = normalize(extractedText);
    const existing = await this.prisma.ocrExtractionLog.findFirst({
      where: { tenantId, companyId, entityType, extractedText: normText, supplierId: supplierId || null },
    });

    if (existing) {
      await this.prisma.ocrExtractionLog.update({
        where: { id: existing.id },
        data: {
          occurrences: { increment: 1 },
          resolvedToId: resolved?.id,
          resolvedText: resolved?.nameAr,
          confidence: resolved?.score ?? 0,
        },
      });

      // إذا تكررت 3 مرات وكان التشابه ≥80% — أنشئ correction rule
      if (
        existing.occurrences >= 2 &&
        resolved &&
        resolved.score >= 0.8 &&
        resolved.score < 0.98
      ) {
        await this.upsertCorrectionRule(tenantId, companyId, entityType, normText, resolved.nameAr, supplierId);
      }
    } else {
      await this.prisma.ocrExtractionLog.create({
        data: {
          tenantId,
          companyId,
          entityType,
          extractedText: normText,
          normalizedText: normText,
          resolvedToId: resolved?.id,
          resolvedText: resolved?.nameAr,
          confidence: resolved?.score ?? 0,
          supplierId: supplierId || null,
        },
      });
    }
  }

  private async upsertCorrectionRule(
    tenantId: string,
    companyId: string,
    entityType: string,
    wrongText: string,
    correctText: string,
    supplierId?: string,
  ) {
    const existing = await this.prisma.ocrCorrectionRule.findFirst({
      where: { tenantId, companyId, entityType, wrongText, supplierId: supplierId || null },
    });

    if (existing) {
      await this.prisma.ocrCorrectionRule.update({
        where: { id: existing.id },
        data: { occurrences: { increment: 1 } },
      });
    } else {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);
      await this.prisma.ocrCorrectionRule.create({
        data: {
          tenantId,
          companyId,
          entityType,
          wrongText,
          correctText,
          supplierId: supplierId || null,
          expiresAt,
        },
      });
    }
  }

  // ─── Cashier submission + background extraction ───────────────────────────

  private validateSubmissionImageBuffer(buf: Buffer, mimeType: string): void {
    const max = 12 * 1024 * 1024;
    if (!buf?.length || buf.length > max) {
      throw new BadRequestException('حجم الصورة غير مقبول (الحد الأقصى 12 ميجابايت).');
    }
    const m = (mimeType || '').toLowerCase();
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(m)) {
      throw new BadRequestException('نوع الملف غير مدعوم. استخدم JPG أو PNG أو WEBP.');
    }
    const b0 = buf[0];
    const b1 = buf[1];
    const isJpeg = b0 === 0xff && b1 === 0xd8;
    const isPng = b0 === 0x89 && buf[1] === 0x50;
    const isWebp = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
    if (!isJpeg && !isPng && !isWebp) {
      throw new BadRequestException('الملف ليس صورة صالحة أو تالف.');
    }
    if (buf.length < 800) {
      throw new BadRequestException('الصورة صغيرة جداً وقد لا تكون قابلة للقراءة.');
    }
  }

  private relativeOcrImagePath(companyId: string, invoiceId: string, ext: string): string {
    return join('ocr-invoices', companyId, `${invoiceId}.${ext}`);
  }

  private absoluteUploadPath(relativePath: string): string {
    return join(process.cwd(), 'uploads', relativePath);
  }

  /** كاشير: رفع صورة — يُنشئ سجلاً ثم يشغّل الاستخراج في الخلفية */
  async submitForExtraction(
    tenantId: string,
    companyId: string,
    submittedByUserId: string,
    dto: SubmitOcrInvoiceDto,
  ) {
    const mime = (dto.mimeType || 'image/jpeg').toLowerCase();
    let buf: Buffer;
    try {
      buf = Buffer.from(dto.imageBase64, 'base64');
    } catch {
      throw new BadRequestException('صورة غير صالحة (تشفير base64).');
    }
    this.validateSubmissionImageBuffer(buf, mime);

    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';

    const inv = await this.prisma.ocrInvoice.create({
      data: {
        tenantId,
        companyId,
        status: OcrInvoiceStatus.QUEUED,
        submittedByUserId,
        extractionError: null,
      },
    });

    const rel = this.relativeOcrImagePath(companyId, inv.id, ext);
    const abs = this.absoluteUploadPath(rel);
    mkdirSync(join(process.cwd(), 'uploads', 'ocr-invoices', companyId), { recursive: true });
    await writeFile(abs, buf);

    await this.prisma.ocrInvoice.update({
      where: { id: inv.id },
      data: { imageUrl: rel.replace(/\\/g, '/') },
    });

    this.scheduleExtractionAfterSubmit(inv.id);

    return { id: inv.id, status: OcrInvoiceStatus.QUEUED };
  }

  private scheduleExtractionAfterSubmit(invoiceId: string): void {
    setImmediate(() => {
      this.processExtractionForInvoice(invoiceId).catch((err) => {
        this.logger.error(`OCR background extraction failed for ${invoiceId}: ${(err as Error).message}`);
      });
    });
  }

  private async processExtractionForInvoice(invoiceId: string): Promise<void> {
    const inv = await this.prisma.ocrInvoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, tenantId: true, companyId: true, imageUrl: true, status: true },
    });
    if (!inv?.imageUrl) return;

    await this.prisma.ocrInvoice.update({
      where: { id: inv.id },
      data: { status: OcrInvoiceStatus.EXTRACTING, extractionError: null },
    });

    const abs = this.absoluteUploadPath(inv.imageUrl);
    if (!existsSync(abs)) {
      await this.prisma.ocrInvoice.update({
        where: { id: inv.id },
        data: {
          status: OcrInvoiceStatus.EXTRACTION_FAILED,
          extractionError: 'ملف الصورة غير موجود على الخادم.',
        },
      });
      return;
    }

    let buf: Buffer;
    try {
      buf = await readFile(abs);
    } catch (e) {
      await this.prisma.ocrInvoice.update({
        where: { id: inv.id },
        data: {
          status: OcrInvoiceStatus.EXTRACTION_FAILED,
          extractionError: `تعذّر قراءة الملف: ${(e as Error).message}`,
        },
      });
      return;
    }

    const mime = inv.imageUrl.endsWith('.png')
      ? 'image/png'
      : inv.imageUrl.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';

    let enriched: Record<string, unknown>;
    try {
      enriched = (await this.extractInvoice(inv.tenantId, inv.companyId, {
        imageBase64: buf.toString('base64'),
        mimeType: mime,
      })) as Record<string, unknown>;
    } catch (e) {
      await this.prisma.ocrInvoice.update({
        where: { id: inv.id },
        data: {
          status: OcrInvoiceStatus.EXTRACTION_FAILED,
          extractionError: (e as Error).message?.slice(0, 2000) || 'فشل الاستخراج',
        },
      });
      return;
    }

    if (enriched.parseError === true) {
      await this.prisma.ocrInvoice.update({
        where: { id: inv.id },
        data: {
          status: OcrInvoiceStatus.EXTRACTION_FAILED,
          extractionError: String(enriched.errorDetail || 'parse_error').slice(0, 2000),
          rawExtraction: enriched as object,
        },
      });
      return;
    }

    await this.applyEnrichedResultToInvoiceRecord(inv.tenantId, inv.companyId, inv.id, enriched);
  }

  /** يحوّل ناتج enrichExtraction إلى سجل فاتورة + سطور بحالة انتظار المراجعة */
  private async applyEnrichedResultToInvoiceRecord(
    tenantId: string,
    companyId: string,
    invoiceId: string,
    enriched: Record<string, unknown>,
  ): Promise<void> {
    const supplierMatch = enriched.supplierMatch as { id?: string } | null | undefined;
    const invNum = enriched.invoiceNumber as { value?: string } | undefined;
    const invDate = enriched.invoiceDate as { value?: string } | undefined;
    const subtotal = enriched.subtotalAmount as { value?: number } | undefined;
    const total = enriched.totalAmount as { value?: number } | undefined;
    const vat = enriched.vatAmount as { value?: number } | undefined;
    const items = (enriched.items || []) as Array<Record<string, unknown>>;

    const lineCreates = items.map((item) => {
      const im = item.itemMatch as { id?: string; status?: string } | null | undefined;
      return {
        rawName: String(item.name || ''),
        nameAr: (item.nameAr as string) || null,
        nameEn: (item.nameEn as string) || null,
        size: (item.size as string) || null,
        sizeUnit: (item.sizeUnit as string) || null,
        itemId: im?.id || null,
        quantity: item.quantity != null ? new Prisma.Decimal(Number(item.quantity)) : null,
        unitPrice: item.unitPrice != null ? new Prisma.Decimal(Number(item.unitPrice)) : null,
        totalPrice: item.totalPrice != null ? new Prisma.Decimal(Number(item.totalPrice)) : null,
        confidence: typeof item.confidence === 'number' ? item.confidence : 0,
        matchStatus: im?.status || 'pending',
      };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.ocrInvoiceLine.deleteMany({ where: { invoiceId } });
      await tx.ocrInvoice.update({
        where: { id: invoiceId },
        data: {
          supplierId: supplierMatch?.id || null,
          invoiceNumber: invNum?.value || null,
          invoiceDate: invDate?.value ? new Date(invDate.value) : null,
          subtotalAmount: subtotal?.value != null ? new Prisma.Decimal(subtotal.value) : null,
          totalAmount: total?.value != null ? new Prisma.Decimal(total.value) : null,
          vatAmount: vat?.value != null ? new Prisma.Decimal(vat.value) : null,
          rawExtraction: enriched as object,
          status: OcrInvoiceStatus.PENDING_REVIEW,
          extractionError: null,
          lines: { create: lineCreates },
        },
      });
    });
  }

  async getReviewQueueInvoices(tenantId: string, companyId: string) {
    return this.prisma.ocrInvoice.findMany({
      where: {
        tenantId,
        companyId,
        status: { in: [...OCR_REVIEW_QUEUE_STATUSES] },
      },
      include: {
        supplier: { select: { id: true, nameAr: true } },
        submittedBy: { select: { id: true, nameAr: true, email: true } },
        lines: { include: { item: { select: { id: true, nameAr: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assertInvoiceImagePath(tenantId: string, companyId: string, invoiceId: string): Promise<string> {
    const inv = await this.prisma.ocrInvoice.findFirst({
      where: { id: invoiceId, tenantId, companyId },
      select: { imageUrl: true },
    });
    if (!inv?.imageUrl) throw new NotFoundException('لا توجد صورة لهذه الفاتورة.');
    const rel = inv.imageUrl.replace(/\\/g, '/');
    if (rel.includes('..') || !rel.startsWith(`ocr-invoices/${companyId}/`)) {
      throw new BadRequestException('مسار الملف غير صالح.');
    }
    const abs = this.absoluteUploadPath(rel);
    if (!existsSync(abs)) throw new NotFoundException('ملف الصورة غير موجود.');
    return abs;
  }

  // ─── Suppliers CRUD ───────────────────────────────────────────────────────

  async getSuppliers(tenantId: string, companyId: string) {
    if (!tenantId || !companyId) return [];
    return this.prisma.ocrSupplier.findMany({
      where: { tenantId, companyId },
      include: {
        aliases: true,
        _count: { select: { invoices: true } },
        accountingSupplier: { select: { id: true, nameAr: true, taxNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSupplier(tenantId: string, companyId: string, dto: CreateOcrSupplierDto) {
    const { accountingSupplierId, ...rest } = dto as CreateOcrSupplierDto & { accountingSupplierId?: string | null };
    let accId: string | null = null;
    if (accountingSupplierId?.trim()) {
      const acc = await this.prisma.supplier.findFirst({
        where: { id: accountingSupplierId.trim(), tenantId, companyId, isDeleted: false },
      });
      if (!acc) throw new BadRequestException('مورد المحاسبة غير موجود أو لا يخص هذه الشركة.');
      accId = acc.id;
    }
    return this.prisma.ocrSupplier.create({
      data: {
        tenantId,
        companyId,
        ...rest,
        accountingSupplierId: accId,
      },
    });
  }

  async updateSupplier(tenantId: string, companyId: string, id: string, dto: Partial<CreateOcrSupplierDto>) {
    const row = await this.prisma.ocrSupplier.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('المورد غير موجود.');
    const data: Prisma.OcrSupplierUpdateInput = {};
    if (dto.nameAr !== undefined) data.nameAr = dto.nameAr;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.taxNumber !== undefined) data.taxNumber = dto.taxNumber;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.accountingSupplierId !== undefined) {
      const v = dto.accountingSupplierId;
      if (v == null || v === '') {
        data.accountingSupplier = { disconnect: true };
      } else {
        const acc = await this.prisma.supplier.findFirst({
          where: { id: v, tenantId, companyId, isDeleted: false },
        });
        if (!acc) throw new BadRequestException('مورد المحاسبة غير موجود أو لا يخص هذه الشركة.');
        data.accountingSupplier = { connect: { id: acc.id } };
      }
    }
    return this.prisma.ocrSupplier.update({ where: { id }, data });
  }

  async deleteSupplier(tenantId: string, companyId: string, id: string) {
    const row = await this.prisma.ocrSupplier.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('المورد غير موجود.');
    return this.prisma.ocrSupplier.delete({ where: { id } });
  }

  // ─── Items CRUD ───────────────────────────────────────────────────────────

  async getItems(tenantId: string, companyId: string) {
    if (!tenantId || !companyId) return [];
    return this.prisma.ocrItem.findMany({
      where: { tenantId, companyId },
      include: { aliases: true, _count: { select: { priceHistory: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createItem(tenantId: string, companyId: string, dto: CreateOcrItemDto) {
    return this.prisma.ocrItem.create({
      data: { tenantId, companyId, ...dto },
    });
  }

  async updateItem(tenantId: string, companyId: string, id: string, dto: Partial<CreateOcrItemDto>) {
    const row = await this.prisma.ocrItem.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('الصنف غير موجود.');
    return this.prisma.ocrItem.update({
      where: { id },
      data: dto,
    });
  }

  async deleteItem(tenantId: string, companyId: string, id: string) {
    const row = await this.prisma.ocrItem.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('الصنف غير موجود.');
    return this.prisma.ocrItem.delete({ where: { id } });
  }

  /**
   * يبحث عن أصناف مكررة (تشابه ≥ 0.78 بعد التطبيع الذكي).
   * يُرجع مجموعات الأصناف المتشابهة مع درجة التشابه.
   */
  async findDuplicateItems(tenantId: string, companyId: string) {
    if (!tenantId || !companyId) return [];
    const items = await this.prisma.ocrItem.findMany({
      where: { tenantId, companyId },
      include: { aliases: true, _count: { select: { priceHistory: true, lines: true } } },
    });

    const groups: Array<{
      items: typeof items;
      score: number;
    }> = [];

    const visited = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      if (visited.has(items[i].id)) continue;
      const group = [items[i]];
      const { ar: iAr, en: iEn } = normalizeItemForSearch(items[i].nameAr);
      const iSearch = iAr || iEn || items[i].nameAr;

      for (let j = i + 1; j < items.length; j++) {
        if (visited.has(items[j].id)) continue;
        const matchJ = findBestItemMatch(iSearch, [items[j]]);
        if (matchJ && matchJ.score >= 0.78) {
          group.push(items[j]);
          visited.add(items[j].id);
        }
      }

      if (group.length > 1) {
        // أعلى score بين أي زوج
        const score = findBestItemMatch(iSearch, group.slice(1))?.score ?? 0;
        groups.push({ items: group, score });
        group.forEach((g) => visited.add(g.id));
      }
    }

    return groups.sort((a, b) => b.score - a.score);
  }

  /**
   * يدمج صنفَين — يُبقي على الـ canonical (الأساسي) وينقل كل البيانات من المكرر إليه ثم يحذف المكرر.
   */
  async mergeItems(tenantId: string, companyId: string, keepId: string, mergeId: string) {
    if (keepId === mergeId) throw new Error('Cannot merge item with itself');

    const [keep, dup] = await Promise.all([
      this.prisma.ocrItem.findFirst({ where: { id: keepId, tenantId, companyId } }),
      this.prisma.ocrItem.findFirst({ where: { id: mergeId, tenantId, companyId } }),
    ]);
    if (!keep || !dup) throw new Error('Item not found');

    await this.prisma.$transaction([
      // نقل سطور الفواتير
      this.prisma.ocrInvoiceLine.updateMany({ where: { itemId: mergeId }, data: { itemId: keepId } }),
      // نقل تاريخ الأسعار
      this.prisma.ocrPriceHistory.updateMany({ where: { itemId: mergeId }, data: { itemId: keepId } }),
      // نقل الأسماء البديلة (aliases) — بإضافة اسم المكرر كـ alias
      this.prisma.ocrItemAlias.createMany({
        data: [
          { itemId: keepId, alias: dup.nameAr, language: 'ar', addedBy: 'merge' },
          ...(dup.nameEn ? [{ itemId: keepId, alias: dup.nameEn, language: 'en', addedBy: 'merge' }] : []),
        ],
        skipDuplicates: true,
      }),
      // تحديث hasSizes إذا كان المكرر له أحجام
      ...(dup.hasSizes ? [this.prisma.ocrItem.update({ where: { id: keepId }, data: { hasSizes: true } })] : []),
      // حذف الصنف المكرر
      this.prisma.ocrItem.delete({ where: { id: mergeId } }),
    ]);

    return { merged: mergeId, into: keepId };
  }

  async getItemPriceHistory(tenantId: string, companyId: string, itemId: string) {
    const item = await this.prisma.ocrItem.findFirst({ where: { id: itemId, tenantId, companyId } });
    if (!item) throw new NotFoundException('الصنف غير موجود.');
    return this.prisma.ocrPriceHistory.findMany({
      where: { tenantId, companyId, itemId },
      include: { supplier: { select: { id: true, nameAr: true } } },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  // ─── Invoices CRUD ────────────────────────────────────────────────────────

  async getInvoices(tenantId: string, companyId: string) {
    if (!tenantId || !companyId) return [];
    return this.prisma.ocrInvoice.findMany({
      where: { tenantId, companyId },
      include: {
        supplier: { select: { id: true, nameAr: true } },
        lines: { include: { item: { select: { id: true, nameAr: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoiceById(tenantId: string, companyId: string, id: string) {
    const inv = await this.prisma.ocrInvoice.findFirst({
      where: { id, tenantId, companyId },
      include: {
        supplier: { select: { id: true, nameAr: true, taxNumber: true } },
        lines: { include: { item: { select: { id: true, nameAr: true } } } },
        submittedBy: { select: { id: true, nameAr: true, email: true } },
        linkedPurchaseInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            transactionDate: true,
            kind: true,
          },
        },
      },
    });
    if (!inv) throw new NotFoundException('الفاتورة غير موجودة.');
    return inv;
  }

  /**
   * اقتراح موردي المحاسبة لمطابقة مورد OCR (اسم / الرقم الضريبي).
   * يدعم `q` مع `ocrSupplierId` معاً (اسم من الفاتورة + سجل كتالوج OCR).
   * إن وُجد `accountingSupplierId` على مورد OCR يُعاد ذلك المورد أولاً.
   */
  async getAccountingSupplierSuggestions(
    tenantId: string,
    companyId: string,
    opts: { ocrSupplierId?: string; q?: string; limit?: number },
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 16, 1), 50);
    const qTrim = (opts.q || '').trim();
    let needleAr = qTrim;
    let needleEn = '';
    let taxDigits: string | null = null;
    let linkedAccountingId: string | null = null;
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    if (opts.ocrSupplierId) {
      const o = await this.prisma.ocrSupplier.findFirst({
        where: { id: opts.ocrSupplierId, tenantId, companyId },
        select: {
          nameAr: true,
          nameEn: true,
          taxNumber: true,
          accountingSupplierId: true,
        },
      });
      if (o) {
        linkedAccountingId = o.accountingSupplierId || null;
        const catAr = (o.nameAr || '').trim();
        const catEn = (o.nameEn || '').trim();
        if (!needleAr) needleAr = catAr;
        else if (catAr) needleAr = `${needleAr} ${catAr}`.trim();
        needleEn = catEn;
        const raw = o.taxNumber?.replace(/\D/g, '') || '';
        taxDigits = raw.length >= 9 ? raw : null;
      }
    }
    const na = norm(needleAr);
    const ne = norm(needleEn);
    const tokens = na.split(' ').filter((t) => t.length >= 2);

    if (!na && !ne && !taxDigits) {
      if (linkedAccountingId) {
        const lone = await this.prisma.supplier.findFirst({
          where: { id: linkedAccountingId, tenantId, companyId, isDeleted: false },
          select: { id: true, nameAr: true, nameEn: true, taxNumber: true },
        });
        return lone
          ? [{ ...lone, matchScore: 10000, linkedFromOcr: true as const }]
          : [];
      }
      return [];
    }

    const suppliers = await this.prisma.supplier.findMany({
      where: { tenantId, companyId, isDeleted: false },
      select: { id: true, nameAr: true, nameEn: true, taxNumber: true },
      take: 600,
    });

    const scored = suppliers.map((s) => {
      let score = 0;
      const ar = norm(s.nameAr);
      const en = s.nameEn ? norm(s.nameEn) : '';
      const stax = s.taxNumber?.replace(/\D/g, '') || '';
      if (taxDigits && stax && stax === taxDigits) score += 120;
      if (na && ar === na) score += 80;
      else if (na.length >= 2 && ar.includes(na)) score += 50;
      else if (na.length >= 2 && na.includes(ar) && ar.length >= 3) score += 42;
      else if (na.length >= 2 && ar.includes(na.slice(0, Math.min(12, na.length)))) score += 28;
      if (ne.length >= 2 && en.includes(ne)) score += 35;
      else if (ne.length >= 2 && ne.includes(en) && en.length >= 3) score += 22;
      for (const tok of tokens) {
        if (tok.length >= 2 && ar.includes(tok)) score += 12;
        if (tok.length >= 2 && en.includes(tok)) score += 10;
      }
      return { id: s.id, nameAr: s.nameAr, nameEn: s.nameEn, taxNumber: s.taxNumber, score };
    });

    let list = scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ score, ...rest }) => ({ ...rest, matchScore: score }));

    if (list.length < limit && na.length >= 2) {
      const prefix = na.slice(0, Math.min(8, na.length));
      const extra = await this.prisma.supplier.findMany({
        where: {
          tenantId,
          companyId,
          isDeleted: false,
          OR: [
            { nameAr: { contains: prefix, mode: 'insensitive' } },
            { nameEn: { contains: prefix, mode: 'insensitive' } },
          ],
          NOT: { id: { in: list.map((x) => x.id) } },
        },
        select: { id: true, nameAr: true, nameEn: true, taxNumber: true },
        take: limit - list.length,
      });
      list = [
        ...list,
        ...extra.map((s) => ({
          id: s.id,
          nameAr: s.nameAr,
          nameEn: s.nameEn,
          taxNumber: s.taxNumber,
          matchScore: 5,
        })),
      ];
    }

    if (linkedAccountingId) {
      const linked = suppliers.find((s) => s.id === linkedAccountingId);
      if (linked) {
        const rest = list.filter((x) => x.id !== linked.id);
        list = [
          {
            id: linked.id,
            nameAr: linked.nameAr,
            nameEn: linked.nameEn,
            taxNumber: linked.taxNumber,
            matchScore: 10000,
            linkedFromOcr: true as boolean,
          } as (typeof list)[number],
          ...rest,
        ];
      }
    }

    return list.slice(0, limit);
  }

  /**
   * تقرير فواتير OCR في شهر (حسب تاريخ الفاتورة أو تاريخ الإنشاء) مع أصناف وفئات.
   */
  async getPurchasesMonthlyReport(tenantId: string, companyId: string, month: string) {
    const m = /^(\d{4})-(\d{2})$/.exec((month || '').trim());
    if (!m) throw new BadRequestException('month مطلوب بصيغة YYYY-MM');
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    if (mo < 1 || mo > 12) throw new BadRequestException('شهر غير صالح');
    const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
    const endEx = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));

    const invoices = await this.prisma.ocrInvoice.findMany({
      where: {
        tenantId,
        companyId,
        OR: [
          { AND: [{ invoiceDate: { not: null } }, { invoiceDate: { gte: start, lt: endEx } }] },
          { AND: [{ invoiceDate: null }, { createdAt: { gte: start, lt: endEx } }] },
        ],
      },
      include: {
        supplier: { select: { id: true, nameAr: true, accountingSupplierId: true } },
        lines: {
          include: {
            item: { select: { id: true, nameAr: true, category: true } },
          },
        },
        linkedPurchaseInvoice: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
    });

    type CatAgg = { category: string; lineCount: number; total: Prisma.Decimal };
    const byCategory = new Map<string, CatAgg>();
    type ItemAgg = {
      itemId: string | null;
      nameAr: string;
      category: string | null;
      lineCount: number;
      quantity: Prisma.Decimal;
      total: Prisma.Decimal;
    };
    const byItem = new Map<string, ItemAgg>();

    let lineTotalAll = new Prisma.Decimal(0);
    let lineCountAll = 0;

    for (const inv of invoices) {
      for (const line of inv.lines) {
        lineCountAll += 1;
        const tp = line.totalPrice ?? new Prisma.Decimal(0);
        lineTotalAll = lineTotalAll.add(tp);
        const cat = line.item?.category?.trim() || '—';
        const prevC = byCategory.get(cat) || { category: cat, lineCount: 0, total: new Prisma.Decimal(0) };
        prevC.lineCount += 1;
        prevC.total = prevC.total.add(tp);
        byCategory.set(cat, prevC);

        const itemKey = line.itemId || `raw:${line.rawName}`;
        const nameAr = line.item?.nameAr || line.nameAr || line.rawName || '—';
        const itemCat = line.item?.category ?? null;
        const prevI = byItem.get(itemKey) || {
          itemId: line.itemId,
          nameAr,
          category: itemCat,
          lineCount: 0,
          quantity: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
        };
        prevI.lineCount += 1;
        if (line.quantity) prevI.quantity = prevI.quantity.add(line.quantity);
        prevI.total = prevI.total.add(tp);
        byItem.set(itemKey, prevI);
      }
    }

    return {
      month: `${y}-${String(mo).padStart(2, '0')}`,
      invoiceCount: invoices.length,
      lineCount: lineCountAll,
      grandTotal: lineTotalAll.toNumber(),
      byCategory: [...byCategory.values()]
        .map((c) => ({ category: c.category, lineCount: c.lineCount, total: c.total.toNumber() }))
        .sort((a, b) => b.total - a.total),
      byItem: [...byItem.values()]
        .map((it) => ({
          itemId: it.itemId,
          nameAr: it.nameAr,
          category: it.category,
          lineCount: it.lineCount,
          quantity: it.quantity.toNumber(),
          total: it.total.toNumber(),
        }))
        .sort((a, b) => b.total - a.total),
      invoices: invoices.map((i) => ({
        id: i.id,
        status: i.status,
        invoiceNumber: i.invoiceNumber,
        invoiceDate: i.invoiceDate,
        createdAt: i.createdAt,
        totalAmount: i.totalAmount?.toNumber() ?? null,
        supplier: i.supplier,
        lineCount: i.lines.length,
        linkedPurchaseId: i.linkedPurchaseInvoiceId,
        linkedPurchase: i.linkedPurchaseInvoice,
      })),
    };
  }

  async saveInvoice(tenantId: string, companyId: string, dto: SaveInvoiceDto, caller?: OcrSaveInvoiceCaller) {
    if (dto.purchase && !dto.id) {
      throw new BadRequestException('ربط فاتورة مشتريات متاح فقط عند اعتماد فاتورة من المراجعة (معرّف السجل).');
    }
    if (dto.id) {
      return this.finalizePendingReviewInvoice(tenantId, companyId, dto, caller);
    }

    const { lines, invoiceDate, totalAmount, vatAmount, supplierName, purchase: _purchase, ...invoiceData } = dto;
    void _purchase;

    // ── 1. إنشاء المورد تلقائياً إذا لم يكن موجوداً ───────────────────────
    let supplierId = invoiceData.supplierId || null;
    if (!supplierId && supplierName?.trim()) {
      // تحقق أولاً إذا كان المورد موجوداً بنفس الاسم لتجنب التكرار
      const existing = await this.prisma.ocrSupplier.findFirst({
        where: { tenantId, companyId, nameAr: supplierName.trim() },
      });
      if (existing) {
        supplierId = existing.id;
      } else {
        const newSupplier = await this.prisma.ocrSupplier.create({
          data: { tenantId, companyId, nameAr: supplierName.trim() },
        });
        supplierId = newSupplier.id;
        this.logger.log(`Auto-created OCR supplier: ${supplierName} (${newSupplier.id})`);
      }
    }

    // ── 2. إنشاء الأصناف تلقائياً لكل سطر ليس له itemId ─────────────────
    // جلب جميع الأصناف مرة واحدة للمطابقة الذكية (بدلاً من استعلام لكل سطر)
    const allCatalogItems = await this.prisma.ocrItem.findMany({
      where: { tenantId, companyId },
      include: { aliases: true },
    });

    const processedLines = await Promise.all(
      lines.map(async (line) => {
        let itemId = line.itemId || null;
        if (!itemId && line.rawName?.trim()) {
          // استخدم الاسم النظيف من الـ frontend إن وُجد، أو استخرجه من rawName
          const lineExt = line as {
            nameAr?: string; nameEn?: string;
            size?: string;   sizeUnit?: string;
          };
          const nameAr   = lineExt.nameAr?.trim()   || null;
          const nameEn   = lineExt.nameEn?.trim()   || null;
          const lineSize = lineExt.size              || null;

          // إذا لم تأتِ أسماء نظيفة — استخرجها من rawName
          let searchName: string;
          if (nameAr || nameEn) {
            searchName = nameAr || nameEn!;
          } else {
            const extracted = normalizeItemForSearch(line.rawName.trim());
            searchName = extracted.ar || extracted.en || line.rawName.trim();
          }

          // مطابقة ذكية ضد كتالوج الأصناف
          const matchResult = findBestItemMatch(searchName, allCatalogItems);

          if (matchResult && matchResult.score >= 0.78) {
            // صنف موجود بتشابه كافٍ — لا نُنشئ مكرراً
            itemId = matchResult.item.id;
            if (lineSize) {
              await this.prisma.ocrItem.update({
                where: { id: itemId },
                data: { hasSizes: true },
              }).catch(() => {});
            }
            this.logger.log(
              `Smart-matched item "${searchName}" → "${matchResult.item.nameAr}" (score: ${matchResult.score.toFixed(2)})`,
            );
          } else {
            // صنف جديد — نُخزّن الاسم النظيف (لا rawName الفوضوي)
            const cleanAr = nameAr || (normalizeItemForSearch(line.rawName.trim()).ar) || line.rawName.trim();
            const cleanEn = nameEn || (normalizeItemForSearch(line.rawName.trim()).en) || null;

            const newItem = await this.prisma.ocrItem.create({
              data: {
                tenantId,
                companyId,
                nameAr:   cleanAr,
                nameEn:   cleanEn,
                hasSizes: !!lineSize,
              },
            });
            itemId = newItem.id;

            // أضف rawName كـ alias للمساعدة في المطابقات المستقبلية
            const rawTrimmed = line.rawName.trim();
            if (rawTrimmed !== cleanAr) {
              await this.prisma.ocrItemAlias.create({
                data: { itemId, alias: rawTrimmed, language: 'ar', addedBy: 'ocr-auto' },
              }).catch(() => {});
            }
            // أضف العبوة الكاملة (مثل "4x2.5-kg") alias أيضاً إن اختلفت
            allCatalogItems.push({ ...newItem, nameEn: cleanEn, hasSizes: !!lineSize, aliases: [] });
            this.logger.log(`Auto-created OCR item: "${cleanAr}" (${newItem.id})`);
          }
        }
        return {
          ...line,
          itemId,
          matchStatus: itemId && line.itemId ? (line.matchStatus || 'matched') : itemId ? 'new' : 'pending',
        };
      }),
    );

    // ── 3. حفظ الفاتورة مع السطور ────────────────────────────────────────
    const invoice = await this.prisma.ocrInvoice.create({
      data: {
        tenantId,
        companyId,
        supplierId,
        invoiceNumber:  invoiceData.invoiceNumber  || null,
        imageUrl:       invoiceData.imageUrl        || null,
        rawExtraction:  invoiceData.rawExtraction ? (invoiceData.rawExtraction as object) : undefined,
        notes:          invoiceData.notes           || null,
        subtotalAmount: (invoiceData as { subtotalAmount?: number }).subtotalAmount || null,
        totalAmount:    totalAmount ? totalAmount   : null,
        vatAmount:      vatAmount   ? vatAmount     : null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        status: OcrInvoiceStatus.CONFIRMED,
        lines: {
          create: processedLines.map((l) => ({
            rawName:     l.rawName,
            nameAr:      (l as { nameAr?: string }).nameAr || null,
            nameEn:      (l as { nameEn?: string }).nameEn || null,
            size:        (l as { size?: string }).size || null,
            sizeUnit:    (l as { sizeUnit?: string }).sizeUnit || null,
            itemId:      l.itemId || null,
            quantity:    l.quantity ? l.quantity : null,
            unitPrice:   l.unitPrice ? l.unitPrice : null,
            totalPrice:  l.totalPrice ? l.totalPrice : null,
            confidence:  l.confidence ?? 0,
            matchStatus: l.matchStatus,
          })),
        },
      },
      include: { lines: true },
    });

    // ── 4. حفظ تاريخ الأسعار لكل صنف له مورد وسعر ──────────────────────
    // يُطبِّع الأسعار إلى أساس "خالص الضريبة" قبل الحفظ لضمان مقارنة عادلة.
    //
    // الفواتير السعودية تختلف: بعضها يسجّل سعر الوحدة بدون ضريبة وبعضها بضريبة.
    // الحل: احسب مجموع أسعار السطور وقارنه بالمجموع قبل الضريبة (subtotal) وبعده (total):
    //   – إذا كان يتوافق مع total → الأسعار شاملة الضريبة → قسِّم على (1 + معدل الضريبة)
    //   – إذا كان يتوافق مع subtotal → الأسعار خالصة الضريبة → لا تعديل
    if (supplierId && invoiceDate) {
      // احسب مجموع (سعر الوحدة × الكمية) من السطور
      const lineSum = processedLines.reduce((s, l) => {
        const up = Number(l.unitPrice) || 0;
        const qty = Number(l.quantity)  || 1;
        return s + up * qty;
      }, 0);

      const invoiceExt = invoiceData as { subtotalAmount?: number };
      const subTotal   = invoiceExt.subtotalAmount ? Number(invoiceExt.subtotalAmount) : null;
      const grandTotal = totalAmount ? Number(totalAmount) : null;
      const vatAmt     = vatAmount   ? Number(vatAmount)   : null;

      // معدل الضريبة الضمني
      const impliedVatRate: number = (() => {
        if (vatAmt && subTotal && subTotal > 0) return vatAmt / subTotal;
        if (vatAmt && grandTotal && grandTotal > vatAmt) return vatAmt / (grandTotal - vatAmt);
        return 0.15; // الافتراضي للمملكة
      })();

      // هل أسعار السطور شاملة الضريبة؟
      let normFactor = 1.0;
      if (vatAmt && vatAmt > 0 && lineSum > 0) {
        if (subTotal && grandTotal) {
          const diffFromSubtotal = Math.abs(lineSum - subTotal) / subTotal;
          const diffFromTotal    = Math.abs(lineSum - grandTotal) / grandTotal;
          if (diffFromTotal < diffFromSubtotal && diffFromTotal < 0.06) {
            normFactor = 1 / (1 + impliedVatRate);
          }
        } else if (grandTotal) {
          const diffFromTotal = Math.abs(lineSum - grandTotal) / grandTotal;
          if (diffFromTotal < 0.06) normFactor = 1 / (1 + impliedVatRate);
        }
      }

      for (const line of processedLines) {
        if (line.itemId && line.unitPrice) {
          const normalizedPrice = Math.round(Number(line.unitPrice) * normFactor * 1000) / 1000;
          await this.prisma.ocrPriceHistory.create({
            data: {
              tenantId,
              companyId,
              itemId:      line.itemId,
              supplierId,
              price:       normalizedPrice,
              size:        (line as { size?: string }).size     || null,
              sizeUnit:    (line as { sizeUnit?: string }).sizeUnit || null,
              invoiceDate: new Date(invoiceDate),
              invoiceId:   invoice.id,
            },
          });
        }
      }
    }

    return invoice;
  }

  /** اعتماد فاتورة كانت بانتظار المراجعة بعد تعديل المحاسب — نفس منطق saveInvoice على نفس السجل */
  private async finalizePendingReviewInvoice(
    tenantId: string,
    companyId: string,
    dto: SaveInvoiceDto,
    caller?: OcrSaveInvoiceCaller,
  ) {
    const { id, lines, invoiceDate, totalAmount, vatAmount, supplierName, purchase, ...invoiceData } = dto;
    if (!id) throw new BadRequestException('معرف الفاتورة مطلوب للاعتماد.');

    const existing = await this.prisma.ocrInvoice.findFirst({
      where: { id, tenantId, companyId },
    });
    if (!existing) throw new NotFoundException('الفاتورة غير موجودة.');
    if (existing.status !== OcrInvoiceStatus.PENDING_REVIEW) {
      throw new BadRequestException('يمكن اعتماد الفواتير في حالة «بانتظار المراجعة» فقط.');
    }
    if (purchase && existing.linkedPurchaseInvoiceId) {
      throw new BadRequestException('هذه الفاتورة مرتبطة بفاتورة مشتريات محاسبية مسبقاً.');
    }
    if (purchase) {
      if (!caller?.userId) {
        throw new BadRequestException('تعذّر تحديد المستخدم لإنشاء فاتورة المشتريات.');
      }
      const canPurchase =
        hasPermission(caller.role || '', PERMISSIONS.PURCHASES_WRITE, caller.permissions) ||
        hasPermission(caller.role || '', PERMISSIONS.INVOICES_WRITE, caller.permissions);
      if (!canPurchase) {
        throw new ForbiddenException('لا تملك صلاحية تسجيل مشتريات محاسبية من اعتماد OCR.');
      }
      const totalNum =
        totalAmount != null ? Number(totalAmount) : Number(existing.totalAmount ?? 0);
      if (!totalNum || totalNum <= 0) {
        throw new BadRequestException('المبلغ الإجمالي مطلوب ويجب أن يكون أكبر من صفر لتسجيل فاتورة المشتريات.');
      }
      const isTaxable = purchase.isTaxable !== false;
      const supplierInvNo =
        purchase.supplierInvoiceNumber?.trim() ||
        (invoiceData.invoiceNumber as string | undefined)?.trim() ||
        existing.invoiceNumber?.trim() ||
        undefined;
      if (isTaxable && !supplierInvNo) {
        throw new BadRequestException('رقم فاتورة المورد مطلوب عند تسجيل مشترٍ خاضع للضريبة.');
      }
      const accSup = await this.prisma.supplier.findFirst({
        where: { id: purchase.accountingSupplierId, tenantId, companyId, isDeleted: false },
      });
      if (!accSup) throw new BadRequestException('مورد المحاسبة غير موجود أو غير نشط.');
      const vaulted = await this.prisma.vault.findFirst({
        where: { id: purchase.vaultId, tenantId, companyId },
      });
      if (!vaulted) throw new BadRequestException('الخزنة غير موجودة لهذه الشركة.');
    }

    let supplierId = invoiceData.supplierId || null;
    if (!supplierId && supplierName?.trim()) {
      const sup = await this.prisma.ocrSupplier.findFirst({
        where: { tenantId, companyId, nameAr: supplierName.trim() },
      });
      if (sup) supplierId = sup.id;
      else {
        const newSupplier = await this.prisma.ocrSupplier.create({
          data: { tenantId, companyId, nameAr: supplierName.trim() },
        });
        supplierId = newSupplier.id;
      }
    }

    const allCatalogItems = await this.prisma.ocrItem.findMany({
      where: { tenantId, companyId },
      include: { aliases: true },
    });

    const processedLines = await Promise.all(
      lines.map(async (line) => {
        let itemId = line.itemId || null;
        if (!itemId && line.rawName?.trim()) {
          const lineExt = line as {
            nameAr?: string; nameEn?: string;
            size?: string;   sizeUnit?: string;
          };
          const nameAr   = lineExt.nameAr?.trim()   || null;
          const nameEn   = lineExt.nameEn?.trim()   || null;
          const lineSize = lineExt.size              || null;
          let searchName: string;
          if (nameAr || nameEn) {
            searchName = nameAr || nameEn!;
          } else {
            const extracted = normalizeItemForSearch(line.rawName.trim());
            searchName = extracted.ar || extracted.en || line.rawName.trim();
          }
          const matchResult = findBestItemMatch(searchName, allCatalogItems);
          if (matchResult && matchResult.score >= 0.78) {
            itemId = matchResult.item.id;
            if (lineSize) {
              await this.prisma.ocrItem.update({
                where: { id: itemId },
                data: { hasSizes: true },
              }).catch(() => {});
            }
          } else {
            const cleanAr = nameAr || (normalizeItemForSearch(line.rawName.trim()).ar) || line.rawName.trim();
            const cleanEn = nameEn || (normalizeItemForSearch(line.rawName.trim()).en) || null;
            const newItem = await this.prisma.ocrItem.create({
              data: {
                tenantId,
                companyId,
                nameAr:   cleanAr,
                nameEn:   cleanEn,
                hasSizes: !!lineSize,
              },
            });
            itemId = newItem.id;
            const rawTrimmed = line.rawName.trim();
            if (rawTrimmed !== cleanAr) {
              await this.prisma.ocrItemAlias.create({
                data: { itemId, alias: rawTrimmed, language: 'ar', addedBy: 'ocr-auto' },
              }).catch(() => {});
            }
            allCatalogItems.push({ ...newItem, nameEn: cleanEn, hasSizes: !!lineSize, aliases: [] });
          }
        }
        return {
          ...line,
          itemId,
          matchStatus: itemId && line.itemId ? (line.matchStatus || 'matched') : itemId ? 'new' : 'pending',
        };
      }),
    );

    const invoice = await this.prisma.ocrInvoice.update({
      where: { id },
      data: {
        supplierId,
        invoiceNumber:  invoiceData.invoiceNumber  || null,
        imageUrl:       invoiceData.imageUrl        ?? existing.imageUrl,
        rawExtraction:  invoiceData.rawExtraction ? (invoiceData.rawExtraction as object) : undefined,
        notes:          invoiceData.notes           ?? null,
        subtotalAmount: (invoiceData as { subtotalAmount?: number }).subtotalAmount || null,
        totalAmount:    totalAmount ? totalAmount   : null,
        vatAmount:      vatAmount   ? vatAmount     : null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        status: OcrInvoiceStatus.CONFIRMED,
        lines: {
          deleteMany: {},
          create: processedLines.map((l) => ({
            rawName:     l.rawName,
            nameAr:      (l as { nameAr?: string }).nameAr || null,
            nameEn:      (l as { nameEn?: string }).nameEn || null,
            size:        (l as { size?: string }).size || null,
            sizeUnit:    (l as { sizeUnit?: string }).sizeUnit || null,
            itemId:      l.itemId || null,
            quantity:    l.quantity ? l.quantity : null,
            unitPrice:   l.unitPrice ? l.unitPrice : null,
            totalPrice:  l.totalPrice ? l.totalPrice : null,
            confidence:  l.confidence ?? 0,
            matchStatus: l.matchStatus,
          })),
        },
      },
      include: { lines: true },
    });

    if (supplierId && invoiceDate) {
      const lineSum = processedLines.reduce((s, l) => {
        const up = Number(l.unitPrice) || 0;
        const qty = Number(l.quantity)  || 1;
        return s + up * qty;
      }, 0);
      const invoiceExt = invoiceData as { subtotalAmount?: number };
      const subTotal   = invoiceExt.subtotalAmount ? Number(invoiceExt.subtotalAmount) : null;
      const grandTotal = totalAmount ? Number(totalAmount) : null;
      const vatAmt     = vatAmount   ? Number(vatAmount)   : null;
      const impliedVatRate: number = (() => {
        if (vatAmt && subTotal && subTotal > 0) return vatAmt / subTotal;
        if (vatAmt && grandTotal && grandTotal > vatAmt) return vatAmt / (grandTotal - vatAmt);
        return 0.15;
      })();
      let normFactor = 1.0;
      if (vatAmt && vatAmt > 0 && lineSum > 0) {
        if (subTotal && grandTotal) {
          const diffFromSubtotal = Math.abs(lineSum - subTotal) / subTotal;
          const diffFromTotal    = Math.abs(lineSum - grandTotal) / grandTotal;
          if (diffFromTotal < diffFromSubtotal && diffFromTotal < 0.06) {
            normFactor = 1 / (1 + impliedVatRate);
          }
        } else if (grandTotal) {
          const diffFromTotal = Math.abs(lineSum - grandTotal) / grandTotal;
          if (diffFromTotal < 0.06) normFactor = 1 / (1 + impliedVatRate);
        }
      }
      for (const line of processedLines) {
        if (line.itemId && line.unitPrice) {
          const normalizedPrice = Math.round(Number(line.unitPrice) * normFactor * 1000) / 1000;
          await this.prisma.ocrPriceHistory.create({
            data: {
              tenantId,
              companyId,
              itemId:      line.itemId,
              supplierId,
              price:       normalizedPrice,
              size:        (line as { size?: string }).size     || null,
              sizeUnit:    (line as { sizeUnit?: string }).sizeUnit || null,
              invoiceDate: new Date(invoiceDate),
              invoiceId:   invoice.id,
            },
          });
        }
      }
    }

    if (purchase && caller?.userId) {
      const totalNum =
        totalAmount != null ? Number(totalAmount) : Number(existing.totalAmount ?? 0);
      const isTaxable = purchase.isTaxable !== false;
      const supplierInvNo =
        purchase.supplierInvoiceNumber?.trim() ||
        (invoiceData.invoiceNumber as string | undefined)?.trim() ||
        existing.invoiceNumber?.trim() ||
        undefined;
      let invDateStr: string | undefined;
      if (invoiceDate) {
        invDateStr =
          typeof invoiceDate === 'string'
            ? invoiceDate.slice(0, 10)
            : new Date(invoiceDate as unknown as string).toISOString().slice(0, 10);
      } else if (existing.invoiceDate) {
        invDateStr = existing.invoiceDate.toISOString().slice(0, 10);
      }
      const noteParts = [`OCR:${id}`, invoiceData.notes as string | undefined].filter(Boolean) as string[];
      const notesJoined = noteParts.join(' — ').slice(0, 2000);

      const createDto: CreateInvoiceDto = {
        companyId,
        supplierId: purchase.accountingSupplierId,
        kind: 'purchase',
        totalAmount: totalNum,
        transactionDate: purchase.transactionDate.slice(0, 10),
        invoiceDate: invDateStr,
        vaultId: purchase.vaultId,
        supplierInvoiceNumber: supplierInvNo,
        isTaxable,
        notes: notesJoined,
        idempotencyKey: `ocr-purchase-${id}`,
      };

      const raw = await this.invoiceService.createWithLedger(createDto, caller.userId);
      await this.prisma.ocrInvoice.update({
        where: { id: invoice.id },
        data: { linkedPurchaseInvoiceId: raw.invoice.id },
      });
    }

    return this.prisma.ocrInvoice.findFirst({
      where: { id: invoice.id, tenantId, companyId },
      include: {
        supplier: { select: { id: true, nameAr: true, taxNumber: true } },
        lines: { include: { item: { select: { id: true, nameAr: true } } } },
        submittedBy: { select: { id: true, nameAr: true, email: true } },
        linkedPurchaseInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            transactionDate: true,
            kind: true,
          },
        },
      },
    });
  }

  async confirmInvoice(tenantId: string, companyId: string, id: string, status: string) {
    const row = await this.prisma.ocrInvoice.findFirst({ where: { id, tenantId, companyId } });
    if (!row) throw new NotFoundException('الفاتورة غير موجودة.');
    return this.prisma.ocrInvoice.update({
      where: { id },
      data: { status },
    });
  }

  async bulkDeleteInvoices(tenantId: string, companyId: string, ids: string[]) {
    if (!ids?.length) return { count: 0 };
    const result = await this.prisma.ocrInvoice.deleteMany({
      where: { id: { in: ids }, tenantId, companyId },
    });
    return { count: result.count };
  }

  async bulkDeleteSuppliers(tenantId: string, companyId: string, ids: string[]) {
    if (!ids?.length) return { count: 0 };
    const result = await this.prisma.ocrSupplier.deleteMany({
      where: { id: { in: ids }, tenantId, companyId },
    });
    return { count: result.count };
  }

  async bulkDeleteItems(tenantId: string, companyId: string, ids: string[]) {
    if (!ids?.length) return { count: 0 };
    const result = await this.prisma.ocrItem.deleteMany({
      where: { id: { in: ids }, tenantId, companyId },
    });
    return { count: result.count };
  }

  async bulkDeletePriceHistory(tenantId: string, companyId: string, itemIds: string[]) {
    if (!itemIds?.length) return { count: 0 };
    const result = await this.prisma.ocrPriceHistory.deleteMany({
      where: { itemId: { in: itemIds }, tenantId, companyId },
    });
    return { count: result.count };
  }

  // ─── Price Alerts ─────────────────────────────────────────────────────────

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

    // تجميع بالصنف
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

      // تجاهل التنبيهات التي تعكس فارق الضريبة فقط (≈ 15%)
      // مثال: 189.75 vs 165 → 189.75/165 = 1.15 → فارق الضريبة وليس ارتفاع سعر حقيقي
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

  // ─── Correction Rules ─────────────────────────────────────────────────────

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

  // ─── Aliases ──────────────────────────────────────────────────────────────

  async addSupplierAlias(tenantId: string, companyId: string, supplierId: string, alias: string, language = 'ar') {
    const sup = await this.prisma.ocrSupplier.findFirst({ where: { id: supplierId, tenantId, companyId } });
    if (!sup) throw new NotFoundException('المورد غير موجود.');
    return this.prisma.ocrSupplierAlias.create({
      data: { supplierId, alias, language, addedBy: 'support' },
    });
  }

  async addItemAlias(tenantId: string, companyId: string, itemId: string, alias: string, language = 'ar') {
    const it = await this.prisma.ocrItem.findFirst({ where: { id: itemId, tenantId, companyId } });
    if (!it) throw new NotFoundException('الصنف غير موجود.');
    return this.prisma.ocrItemAlias.create({
      data: { itemId, alias, language, addedBy: 'support' },
    });
  }
}

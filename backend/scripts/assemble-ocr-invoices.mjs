/**
 * يبني 3 خدمات (استخراج، استقبال، كتالوج) + واجهة OcrInvoicesService.
 * سير عمل الفواتير ocr-invoice-workflow* يُبنى ويُقسّم يدوياً — لا تُعاد توليده.
 * npm exec node scripts/assemble-ocr-invoices.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ocrDir = path.join(__dirname, '../src/ocr-invoices');
const p = path.join(ocrDir, 'ocr-invoices.service.ts');
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);

// 1-based → slice [start, end) 0-based
const ext  = lines.slice(364, 767).join('\n');  // 365–767
const int  = lines.slice(767, 1008)
  .join('\n')
  .replace(/this\.extractInvoice\(/g, 'this.extraction.extractInvoice(');
// كتالوج: مورّدون+أصناف ثم (بعد workflow) أسماء بدية
const catA = lines.slice(1009, 1213).join('\n'); // 1010–1213
// حتى } إغلاق addItemAlias (سطر 2125 في المونوليث ~2153) — end صارم: slice(…, 2125)
const catB = lines.slice(2110, 2125).join('\n');
const cat  = [catA, catB].join('\n\n');
const extractionHeader = `/**
 * استخراج Gemini + إثراء المطابقة وتسجيل الاستخراج/قواعد التصحيح.
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getGeminiApiKey } from '../config/gemini.config';
import { normalize } from './ocr-normalize.util';
import { findBestMatch, classifyConfidence } from './ocr-match.util';
import { ExtractInvoiceDto } from './dto/extract-invoice.dto';
import { extractJsonFromOcrLlmText } from '../common/utils/ocr-llm-json.util';
import { validateItemMath, validateInvoiceTotals } from './ocr-invoice-math-validate.util';
import { splitBilingualName, extractSizeFromName, findBestItemMatch } from './ocr-item-name-match.util';
import {
  buildGeminiUrl,
  getGeminiModelsToTry,
  OCR_EXTRACTION_PROMPT,
  type GeminiExtractedInvoice,
} from './ocr-gemini-extract.constants';

@Injectable()
export class OcrExtractionService {
  private readonly logger = new Logger(OcrExtractionService.name);

  constructor(private readonly prisma: PrismaService) {}

`;

const intakeHeader = `/**
 * تقديم الكاشير، الاستخراج الخلفي، طابور المراجعة، ومسار صورة الفاتورة.
 */
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitOcrInvoiceDto } from './dto/submit-ocr.dto';
import { OcrInvoiceStatus, OCR_REVIEW_QUEUE_STATUSES } from './ocr-invoice-status';
import { OcrExtractionService } from './ocr-extraction.service';

@Injectable()
export class OcrIntakeService {
  private readonly logger = new Logger(OcrIntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: OcrExtractionService,
  ) {}

`;

const catalogHeader = `/**
 * كتالوج OCR: مورّدون، أصناف، دمج/تكرار، تاريخ أسعار.
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOcrSupplierDto } from './dto/create-ocr-supplier.dto';
import { CreateOcrItemDto } from './dto/create-ocr-item.dto';
import { findBestItemMatch, normalizeItemForSearch } from './ocr-item-name-match.util';

@Injectable()
export class OcrCatalogService {
  constructor(private readonly prisma: PrismaService) {}

`;

const facade = `/**
 * OcrInvoicesService — واجهة وحدات: استخراج / استقبال / كتالوج / سير عمل فواتير
 */
import { Injectable } from '@nestjs/common';
import { OcrExtractionService } from './ocr-extraction.service';
import { OcrIntakeService } from './ocr-intake.service';
import { OcrCatalogService } from './ocr-catalog.service';
import { OcrInvoiceWorkflowService } from './ocr-invoice-workflow.service';
import type { OcrSaveInvoiceCaller } from './ocr-invoices.types';

export type { OcrSaveInvoiceCaller } from './ocr-invoices.types';

@Injectable()
export class OcrInvoicesService {
  constructor(
    private readonly extraction: OcrExtractionService,
    private readonly intake: OcrIntakeService,
    private readonly catalog: OcrCatalogService,
    private readonly workflow: OcrInvoiceWorkflowService,
  ) {}

  extractInvoice(
    ...args: Parameters<OcrExtractionService['extractInvoice']>
  ) { return this.extraction.extractInvoice(...args); }

  submitForExtraction(
    ...args: Parameters<OcrIntakeService['submitForExtraction']>
  ) { return this.intake.submitForExtraction(...args); }

  getReviewQueueInvoices(
    ...args: Parameters<OcrIntakeService['getReviewQueueInvoices']>
  ) { return this.intake.getReviewQueueInvoices(...args); }

  assertInvoiceImagePath(
    ...args: Parameters<OcrIntakeService['assertInvoiceImagePath']>
  ) { return this.intake.assertInvoiceImagePath(...args); }

  getInvoices(
    ...args: Parameters<OcrInvoiceWorkflowService['getInvoices']>
  ) { return this.workflow.getInvoices(...args); }

  getInvoiceById(
    ...args: Parameters<OcrInvoiceWorkflowService['getInvoiceById']>
  ) { return this.workflow.getInvoiceById(...args); }

  getAccountingSupplierSuggestions(
    ...args: Parameters<OcrInvoiceWorkflowService['getAccountingSupplierSuggestions']>
  ) { return this.workflow.getAccountingSupplierSuggestions(...args); }

  getPurchasesMonthlyReport(
    ...args: Parameters<OcrInvoiceWorkflowService['getPurchasesMonthlyReport']>
  ) { return this.workflow.getPurchasesMonthlyReport(...args); }

  saveInvoice(
    ...args: Parameters<OcrInvoiceWorkflowService['saveInvoice']>
  ) { return this.workflow.saveInvoice(...args); }

  confirmInvoice(
    ...args: Parameters<OcrInvoiceWorkflowService['confirmInvoice']>
  ) { return this.workflow.confirmInvoice(...args); }

  bulkDeleteInvoices(
    ...args: Parameters<OcrInvoiceWorkflowService['bulkDeleteInvoices']>
  ) { return this.workflow.bulkDeleteInvoices(...args); }

  bulkDeleteSuppliers(
    ...args: Parameters<OcrInvoiceWorkflowService['bulkDeleteSuppliers']>
  ) { return this.workflow.bulkDeleteSuppliers(...args); }

  bulkDeleteItems(
    ...args: Parameters<OcrInvoiceWorkflowService['bulkDeleteItems']>
  ) { return this.workflow.bulkDeleteItems(...args); }

  bulkDeletePriceHistory(
    ...args: Parameters<OcrInvoiceWorkflowService['bulkDeletePriceHistory']>
  ) { return this.workflow.bulkDeletePriceHistory(...args); }

  getSuppliers(
    ...args: Parameters<OcrCatalogService['getSuppliers']>
  ) { return this.catalog.getSuppliers(...args); }

  createSupplier(
    ...args: Parameters<OcrCatalogService['createSupplier']>
  ) { return this.catalog.createSupplier(...args); }

  updateSupplier(
    ...args: Parameters<OcrCatalogService['updateSupplier']>
  ) { return this.catalog.updateSupplier(...args); }

  deleteSupplier(
    ...args: Parameters<OcrCatalogService['deleteSupplier']>
  ) { return this.catalog.deleteSupplier(...args); }

  getItems(
    ...args: Parameters<OcrCatalogService['getItems']>
  ) { return this.catalog.getItems(...args); }

  createItem(
    ...args: Parameters<OcrCatalogService['createItem']>
  ) { return this.catalog.createItem(...args); }

  updateItem(
    ...args: Parameters<OcrCatalogService['updateItem']>
  ) { return this.catalog.updateItem(...args); }

  deleteItem(
    ...args: Parameters<OcrCatalogService['deleteItem']>
  ) { return this.catalog.deleteItem(...args); }

  findDuplicateItems(
    ...args: Parameters<OcrCatalogService['findDuplicateItems']>
  ) { return this.catalog.findDuplicateItems(...args); }

  mergeItems(
    ...args: Parameters<OcrCatalogService['mergeItems']>
  ) { return this.catalog.mergeItems(...args); }

  getItemPriceHistory(
    ...args: Parameters<OcrCatalogService['getItemPriceHistory']>
  ) { return this.catalog.getItemPriceHistory(...args); }

  getPriceAlerts(
    ...args: Parameters<OcrInvoiceWorkflowService['getPriceAlerts']>
  ) { return this.workflow.getPriceAlerts(...args); }

  getCorrectionRules(
    ...args: Parameters<OcrInvoiceWorkflowService['getCorrectionRules']>
  ) { return this.workflow.getCorrectionRules(...args); }

  updateCorrectionRule(
    ...args: Parameters<OcrInvoiceWorkflowService['updateCorrectionRule']>
  ) { return this.workflow.updateCorrectionRule(...args); }

  addSupplierAlias(
    ...args: Parameters<OcrCatalogService['addSupplierAlias']>
  ) { return this.catalog.addSupplierAlias(...args); }

  addItemAlias(
    ...args: Parameters<OcrCatalogService['addItemAlias']>
  ) { return this.catalog.addItemAlias(...args); }
}
`;

fs.writeFileSync(path.join(ocrDir, 'ocr-extraction.service.ts'), extractionHeader + ext + '\n}\n', 'utf8');
fs.writeFileSync(path.join(ocrDir, 'ocr-intake.service.ts'), intakeHeader + int + '\n}\n', 'utf8');
fs.writeFileSync(path.join(ocrDir, 'ocr-catalog.service.ts'), catalogHeader + cat + '\n}\n', 'utf8');
fs.writeFileSync(path.join(ocrDir, 'ocr-invoices.service.ts'), facade, 'utf8');
console.log('Wrote ocr-extraction, ocr-intake, ocr-catalog, ocr-invoices (facade) — skipped ocr-invoice-workflow*');

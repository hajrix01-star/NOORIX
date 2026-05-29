/**
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

  retryExtractionForInvoice(
    ...args: Parameters<OcrIntakeService['retryExtractionForInvoice']>
  ) { return this.intake.retryExtractionForInvoice(...args); }

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

  getOperationsDashboard(
    ...args: Parameters<OcrInvoiceWorkflowService['getOperationsDashboard']>
  ) { return this.workflow.getOperationsDashboard(...args); }

  getSemanticKeywordInsights(
    ...args: Parameters<OcrInvoiceWorkflowService['getSemanticKeywordInsights']>
  ) { return this.workflow.getSemanticKeywordInsights(...args); }

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

/**
 * OcrInvoiceWorkflowService — واجهة: قراءة، تقرير، حفظ/اعتماد، حذف/تأكيد، تنبيهات/قواعد
 */
import { Injectable } from '@nestjs/common';
import { OcrInvoiceWorkflowReaderService } from './ocr-invoice-workflow-reader.service';
import { OcrInvoiceWorkflowReportService } from './ocr-invoice-workflow-report.service';
import { OcrInvoiceWorkflowPersistService } from './ocr-invoice-workflow-persist.service';
import { OcrInvoiceWorkflowBulkService } from './ocr-invoice-workflow-bulk.service';
import { OcrInvoiceWorkflowInsightsService } from './ocr-invoice-workflow-insights.service';
import type { OcrSaveInvoiceCaller } from './ocr-invoices.types';
import type { SaveInvoiceDto } from './dto/save-invoice.dto';

@Injectable()
export class OcrInvoiceWorkflowService {
  constructor(
    private readonly reader: OcrInvoiceWorkflowReaderService,
    private readonly report: OcrInvoiceWorkflowReportService,
    private readonly persist: OcrInvoiceWorkflowPersistService,
    private readonly bulk: OcrInvoiceWorkflowBulkService,
    private readonly insights: OcrInvoiceWorkflowInsightsService,
  ) {}

  getInvoices(...args: Parameters<OcrInvoiceWorkflowReaderService['getInvoices']>) {
    return this.reader.getInvoices(...args);
  }

  getInvoiceById(...args: Parameters<OcrInvoiceWorkflowReaderService['getInvoiceById']>) {
    return this.reader.getInvoiceById(...args);
  }

  getAccountingSupplierSuggestions(
    ...args: Parameters<OcrInvoiceWorkflowReaderService['getAccountingSupplierSuggestions']>
  ) {
    return this.reader.getAccountingSupplierSuggestions(...args);
  }

  getPurchasesMonthlyReport(
    ...args: Parameters<OcrInvoiceWorkflowReportService['getPurchasesMonthlyReport']>
  ) {
    return this.report.getPurchasesMonthlyReport(...args);
  }

  saveInvoice(
    tenantId: string,
    companyId: string,
    dto: SaveInvoiceDto,
    caller?: OcrSaveInvoiceCaller,
  ) {
    return this.persist.saveInvoice(tenantId, companyId, dto, caller);
  }

  confirmInvoice(...args: Parameters<OcrInvoiceWorkflowBulkService['confirmInvoice']>) {
    return this.bulk.confirmInvoice(...args);
  }

  bulkDeleteInvoices(...args: Parameters<OcrInvoiceWorkflowBulkService['bulkDeleteInvoices']>) {
    return this.bulk.bulkDeleteInvoices(...args);
  }

  bulkDeleteSuppliers(...args: Parameters<OcrInvoiceWorkflowBulkService['bulkDeleteSuppliers']>) {
    return this.bulk.bulkDeleteSuppliers(...args);
  }

  bulkDeleteItems(...args: Parameters<OcrInvoiceWorkflowBulkService['bulkDeleteItems']>) {
    return this.bulk.bulkDeleteItems(...args);
  }

  bulkDeletePriceHistory(
    ...args: Parameters<OcrInvoiceWorkflowBulkService['bulkDeletePriceHistory']>
  ) {
    return this.bulk.bulkDeletePriceHistory(...args);
  }

  getPriceAlerts(...args: Parameters<OcrInvoiceWorkflowInsightsService['getPriceAlerts']>) {
    return this.insights.getPriceAlerts(...args);
  }

  getOperationsDashboard(
    ...args: Parameters<OcrInvoiceWorkflowInsightsService['getOperationsDashboard']>
  ) {
    return this.insights.getOperationsDashboard(...args);
  }

  getSemanticKeywordInsights(
    ...args: Parameters<OcrInvoiceWorkflowInsightsService['getSemanticKeywordInsights']>
  ) {
    return this.insights.getSemanticKeywordInsights(...args);
  }

  getCorrectionRules(...args: Parameters<OcrInvoiceWorkflowInsightsService['getCorrectionRules']>) {
    return this.insights.getCorrectionRules(...args);
  }

  updateCorrectionRule(
    ...args: Parameters<OcrInvoiceWorkflowInsightsService['updateCorrectionRule']>
  ) {
    return this.insights.updateCorrectionRule(...args);
  }
}

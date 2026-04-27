import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule }         from '../prisma/prisma.module';
import { InvoiceModule }       from '../invoice/invoice.module';
import { OcrInvoicesController } from './ocr-invoices.controller';
import { OcrInvoicesService }    from './ocr-invoices.service';
import { OcrExtractionService }  from './ocr-extraction.service';
import { OcrIntakeService }     from './ocr-intake.service';
import { OcrUploadsLocalStorage } from './ocr-uploads-local.storage';
import { OCR_EXTRACTION_QUEUE } from './ocr-queue.constants';
import { OcrExtractionProcessor } from './ocr-extraction.processor';
import { OcrCatalogService }    from './ocr-catalog.service';
import { OcrInvoiceWorkflowService } from './ocr-invoice-workflow.service';
import { OcrInvoiceWorkflowReaderService } from './ocr-invoice-workflow-reader.service';
import { OcrInvoiceWorkflowReportService } from './ocr-invoice-workflow-report.service';
import { OcrInvoiceWorkflowPersistService } from './ocr-invoice-workflow-persist.service';
import { OcrInvoiceWorkflowBulkService } from './ocr-invoice-workflow-bulk.service';
import { OcrInvoiceWorkflowInsightsService } from './ocr-invoice-workflow-insights.service';

@Module({
  imports:     [
    PrismaModule,
    InvoiceModule,
    BullModule.registerQueue({ name: OCR_EXTRACTION_QUEUE }),
  ],
  controllers: [OcrInvoicesController],
  providers:   [
    OcrUploadsLocalStorage,
    OcrExtractionProcessor,
    OcrExtractionService,
    OcrIntakeService,
    OcrCatalogService,
    OcrInvoiceWorkflowReaderService,
    OcrInvoiceWorkflowReportService,
    OcrInvoiceWorkflowPersistService,
    OcrInvoiceWorkflowBulkService,
    OcrInvoiceWorkflowInsightsService,
    OcrInvoiceWorkflowService,
    OcrInvoicesService,
  ],
  exports:     [OcrInvoicesService],
})
export class OcrInvoicesModule {}

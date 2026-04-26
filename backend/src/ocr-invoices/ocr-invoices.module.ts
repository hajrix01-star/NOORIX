import { Module } from '@nestjs/common';
import { PrismaModule }         from '../prisma/prisma.module';
import { InvoiceModule }       from '../invoice/invoice.module';
import { OcrInvoicesController } from './ocr-invoices.controller';
import { OcrInvoicesService }    from './ocr-invoices.service';
import { OcrExtractionService }  from './ocr-extraction.service';
import { OcrIntakeService }     from './ocr-intake.service';
import { OcrCatalogService }    from './ocr-catalog.service';
import { OcrInvoiceWorkflowService } from './ocr-invoice-workflow.service';

@Module({
  imports:     [PrismaModule, InvoiceModule],
  controllers: [OcrInvoicesController],
  providers:   [
    OcrExtractionService,
    OcrIntakeService,
    OcrCatalogService,
    OcrInvoiceWorkflowService,
    OcrInvoicesService,
  ],
  exports:     [OcrInvoicesService],
})
export class OcrInvoicesModule {}

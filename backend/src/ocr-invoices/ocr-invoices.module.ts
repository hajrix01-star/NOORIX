import { Module } from '@nestjs/common';
import { PrismaModule }         from '../prisma/prisma.module';
import { InvoiceModule }       from '../invoice/invoice.module';
import { OcrInvoicesController } from './ocr-invoices.controller';
import { OcrInvoicesService }    from './ocr-invoices.service';

@Module({
  imports:     [PrismaModule, InvoiceModule],
  controllers: [OcrInvoicesController],
  providers:   [OcrInvoicesService],
  exports:     [OcrInvoicesService],
})
export class OcrInvoicesModule {}

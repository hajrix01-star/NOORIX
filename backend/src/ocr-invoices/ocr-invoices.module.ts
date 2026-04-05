import { Module } from '@nestjs/common';
import { PrismaModule }         from '../prisma/prisma.module';
import { OcrInvoicesController } from './ocr-invoices.controller';
import { OcrInvoicesService }    from './ocr-invoices.service';

@Module({
  imports:     [PrismaModule],
  controllers: [OcrInvoicesController],
  providers:   [OcrInvoicesService],
  exports:     [OcrInvoicesService],
})
export class OcrInvoicesModule {}

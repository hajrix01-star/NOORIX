import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { BankStatementsService } from './bank-statements.service';

@Controller('bank-statements')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class BankStatementsController {
  constructor(private readonly service: BankStatementsService) {}

  @Post('upload')
  @RequirePermission('REPORTS_READ')
  async upload(@Body() body: { companyId: string; fileName: string; fileFormat: string; raw: string[][] }) {
    if (!body.companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    if (!body.raw?.length) throw new HttpException('raw مطلوب وغير فارغ', HttpStatus.BAD_REQUEST);
    return this.service.uploadAndAnalyze(body.companyId, {
      fileName: body.fileName || 'كشف.xlsx',
      fileFormat: body.fileFormat || 'excel',
      raw: body.raw,
    });
  }

  @Patch(':id/confirm-mapping')
  @RequirePermission('REPORTS_READ')
  async confirmMapping(
    @Param('id') id: string,
    @Body()
    body: {
      companyId: string;
      companyName: string;
      bankName: string;
      startDate?: string;
      endDate?: string;
      headerRow: number;
      dataStartRow: number;
      dataEndRow: number;
      columnMapping: Record<string, number>;
      raw: string[][];
    },
  ) {
    if (!body.companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.confirmMapping(body.companyId, id, body as any);
  }

  @Get('summary')
  @RequirePermission('REPORTS_READ')
  async summary(@Query('companyId') companyId: string) {
    if (!companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.getSummary(companyId);
  }

  @Get('categories')
  @RequirePermission('REPORTS_READ')
  async getCategories(@Query('companyId') companyId: string) {
    if (!companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.getCategories(companyId);
  }

  @Get()
  @RequirePermission('REPORTS_READ')
  async list(@Query('companyId') companyId: string, @Query('month') month?: string, @Query('bankName') bankName?: string) {
    if (!companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.list(companyId, { month, bankName });
  }

  @Get(':id')
  @RequirePermission('REPORTS_READ')
  async findOne(@Query('companyId') companyId: string, @Param('id') id: string) {
    if (!companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.findOne(companyId, id);
  }

  @Patch(':id/transactions/:txId/category')
  @RequirePermission('REPORTS_READ')
  async updateTxCategory(
    @Param('id') statementId: string,
    @Param('txId') txId: string,
    @Body() body: { companyId: string; categoryId: string | null },
  ) {
    if (!body.companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.updateTransactionCategory(body.companyId, statementId, txId, body.categoryId);
  }

  @Patch(':id/transactions/:txId/note')
  @RequirePermission('REPORTS_READ')
  async updateTxNote(
    @Param('id') statementId: string,
    @Param('txId') txId: string,
    @Body() body: { companyId: string; note: string | null },
  ) {
    if (!body.companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.updateTransactionNote(body.companyId, statementId, txId, body.note);
  }

  @Delete(':id')
  @RequirePermission('REPORTS_READ')
  async delete(@Query('companyId') companyId: string, @Param('id') id: string) {
    if (!companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.delete(companyId, id);
  }

  @Post('categories')
  @RequirePermission('REPORTS_READ')
  async createCategory(@Body() body: { companyId: string; nameAr: string; nameEn?: string; color?: string }) {
    if (!body.companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.createCategory(body.companyId, body);
  }

  @Delete('categories/:id')
  @RequirePermission('REPORTS_READ')
  async deleteCategory(@Query('companyId') companyId: string, @Param('id') id: string) {
    if (!companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.deleteCategory(companyId, id);
  }
}

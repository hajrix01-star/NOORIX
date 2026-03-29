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

  @Post('suggest-header-metadata')
  @RequirePermission('REPORTS_READ')
  async suggestHeaderMetadata(@Body() body: { companyId: string; raw: string[][] }) {
    if (!body.companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    if (!body.raw?.length) throw new HttpException('raw مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.suggestHeaderMetadata(body.raw);
  }

  @Post(':id/reclassify')
  @RequirePermission('REPORTS_READ')
  async reclassify(@Param('id') id: string, @Body() body: { companyId: string }) {
    if (!body.companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.reclassifyStatement(body.companyId, id);
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

  @Get('reconciliation-stats')
  @RequirePermission('REPORTS_READ')
  async reconciliationStats(
    @Query('companyId') companyId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!companyId || !startDate || !endDate) {
      throw new HttpException('companyId و startDate و endDate مطلوبة', HttpStatus.BAD_REQUEST);
    }
    return this.service.getReconciliationStats(companyId, startDate, endDate);
  }

  @Get('templates')
  @RequirePermission('REPORTS_READ')
  async listTemplates(@Query('companyId') companyId: string) {
    if (!companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.listTemplates(companyId);
  }

  @Patch('templates/:templateId')
  @RequirePermission('REPORTS_READ')
  async setTemplateIsActive(
    @Param('templateId') templateId: string,
    @Body() body: { companyId: string; isActive: boolean },
  ) {
    if (!body?.companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    if (typeof body.isActive !== 'boolean') {
      throw new HttpException('isActive مطلوب (boolean)', HttpStatus.BAD_REQUEST);
    }
    return this.service.setTemplateIsActive(body.companyId, templateId, body.isActive);
  }

  @Delete('templates/:templateId')
  @RequirePermission('REPORTS_READ')
  async deleteTemplate(@Query('companyId') companyId: string, @Param('templateId') templateId: string) {
    if (!companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.deleteTemplate(companyId, templateId);
  }

  @Get('tree-categories')
  @RequirePermission('REPORTS_READ')
  async listTreeCategories(@Query('companyId') companyId: string) {
    if (!companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.listTreeCategories(companyId);
  }

  @Post('tree-categories')
  @RequirePermission('REPORTS_READ')
  async createTreeCategory(
    @Body()
    body: {
      companyId: string;
      name: string;
      sortOrder?: number;
      transactionSide?: string;
      transactionType?: string | null;
      parentKeywords: string[];
      classifications: { name: string; keywords: string[] }[];
    },
  ) {
    if (!body.companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.createTreeCategory(body.companyId, body);
  }

  @Patch('tree-categories/:cid')
  @RequirePermission('REPORTS_READ')
  async updateTreeCategory(
    @Param('cid') cid: string,
    @Body()
    body: {
      companyId: string;
      name?: string;
      sortOrder?: number;
      isActive?: boolean;
      transactionSide?: string;
      transactionType?: string | null;
      parentKeywords?: string[];
      classifications?: { name: string; keywords: string[] }[];
    },
  ) {
    if (!body.companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    const { companyId, ...rest } = body;
    return this.service.updateTreeCategory(companyId, cid, rest);
  }

  @Delete('tree-categories/:cid')
  @RequirePermission('REPORTS_READ')
  async deleteTreeCategory(@Query('companyId') companyId: string, @Param('cid') cid: string) {
    if (!companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.deleteTreeCategory(companyId, cid);
  }

  @Post('tree-categories/seed-defaults')
  @RequirePermission('REPORTS_READ')
  async seedDefaultTreeCategories(@Body() body: { companyId: string }) {
    if (!body?.companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.seedDefaultTreeCategoriesIfEmpty(body.companyId);
  }

  @Get('classification-rules')
  @RequirePermission('REPORTS_READ')
  async listRules(@Query('companyId') companyId: string) {
    if (!companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.listClassificationRules(companyId);
  }

  @Post('classification-rules')
  @RequirePermission('REPORTS_READ')
  async createRule(
    @Body()
    body: {
      companyId: string;
      keyword: string;
      matchType?: string;
      categoryName: string;
      transactionSide?: string;
      transactionType?: string | null;
      priority?: number;
    },
  ) {
    if (!body.companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.createClassificationRule(body.companyId, body);
  }

  @Delete('classification-rules/:rid')
  @RequirePermission('REPORTS_READ')
  async deleteRule(@Query('companyId') companyId: string, @Param('rid') rid: string) {
    if (!companyId) throw new HttpException('companyId مطلوب', HttpStatus.BAD_REQUEST);
    return this.service.deleteClassificationRule(companyId, rid);
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

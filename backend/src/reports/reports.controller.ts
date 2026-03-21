import { Controller, Get, Post, Delete, UseGuards, Query, Body, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import {
  GetGeneralProfitLossDetailsQueryDto,
  GetGeneralProfitLossQueryDto,
  GetGeneralProfitLossTrendQueryDto,
} from './dto/general-profit-loss.dto';
import { GetTaxVatQueryDto } from './dto/tax-vat.dto';
import { GetPeriodAnalyticsQueryDto } from './dto/period-analytics.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('general-profit-loss')
  @RequirePermission('REPORTS_READ')
  async getGeneralProfitLoss(@Query() query: GetGeneralProfitLossQueryDto) {
    return this.reportsService.getGeneralProfitLoss(query.companyId, query.year);
  }

  @Get('general-profit-loss/details')
  @RequirePermission('REPORTS_READ')
  async getGeneralProfitLossDetails(@Query() query: GetGeneralProfitLossDetailsQueryDto) {
    return this.reportsService.getGeneralProfitLossDetails(
      query.companyId,
      query.year,
      query.month,
      query.groupKey,
      query.itemKey,
    );
  }

  @Get('general-profit-loss/trend')
  @RequirePermission('REPORTS_READ')
  async getGeneralProfitLossTrend(@Query() query: GetGeneralProfitLossTrendQueryDto) {
    return this.reportsService.getGeneralProfitLossTrend(
      query.companyId,
      query.year,
      query.groupKey,
      query.itemKey,
    );
  }

  @Get('tax-vat')
  @RequirePermission('REPORTS_READ')
  async getTaxVat(@Query() query: GetTaxVatQueryDto) {
    return this.reportsService.getTaxVatReport(query.companyId, query.year, query.period);
  }

  @Get('period-analytics')
  @RequirePermission('REPORTS_READ')
  async getPeriodAnalytics(@Query() query: GetPeriodAnalyticsQueryDto) {
    return this.reportsService.getPeriodAnalytics(query.companyId, query.startDate, query.endDate);
  }

  @Get('bank-statement-templates')
  @RequirePermission('REPORTS_READ')
  async getBankStatementTemplates(@Query('companyId') companyId: string) {
    return this.reportsService.getBankStatementTemplates(companyId);
  }

  @Post('bank-statement-templates')
  @RequirePermission('REPORTS_READ')
  async createBankStatementTemplate(
    @Body()
    body: {
      companyId: string;
      bankName: string;
      columnTypes: Record<number, string>;
      dataStartRow: number;
      dataEndRow: number;
      colCount: number;
    },
  ) {
    return this.reportsService.createBankStatementTemplate(body.companyId, body);
  }

  @Delete('bank-statement-templates/:id')
  @RequirePermission('REPORTS_READ')
  async deleteBankStatementTemplate(
    @Query('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.reportsService.deleteBankStatementTemplate(companyId, id);
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { LedgerService } from './ledger.service';

@Controller('ledger')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  @RequirePermission('REPORTS_READ')
  async findAll(
    @CompanyId() companyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') q?: string,
  ) {
    if (!companyId) return { items: [], total: 0, page: 1, pageSize: 50 };

    // دعم كلا الصيغتين: startDate/endDate و fromDate/toDate
    const start = startDate || fromDate;
    const end   = endDate   || toDate;

    return this.ledgerService.findAll(
      companyId,
      start,
      end,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
      q,
    );
  }
}

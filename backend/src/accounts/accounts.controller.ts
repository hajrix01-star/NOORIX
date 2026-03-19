import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard }          from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard }         from '../auth/guards/roles.guard';
import { RequirePermission }  from '../auth/decorators/require-permission.decorator';
import { AccountsService }    from './accounts.service';

@Controller('accounts')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @RequirePermission('SUPPLIERS_READ')
  findAll(@Query('companyId') companyId: string) {
    if (!companyId) return [];
    return this.accountsService.findAll(companyId);
  }
}

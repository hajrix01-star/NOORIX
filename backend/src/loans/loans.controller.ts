import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LoansService } from './loans.service';
import { CreateLoanDto, CreateLoanPaymentDto, ReverseLoanPaymentDto } from './dto/loan.dto';
@Controller('loans') @UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class LoansController { constructor(private readonly service: LoansService) {}
  @Get() @RequirePermission('EXPENSES_READ') list(@CompanyId() companyId: string) { return this.service.list(companyId); }
  @Post() @RequirePermission('EXPENSES_WRITE') create(@CompanyId() companyId: string, @CurrentUser() user: JwtUser, @Body() dto: CreateLoanDto) { return this.service.create(companyId, dto, user.sub); }
  @Post(':id/payments') @RequirePermission('EXPENSES_WRITE') pay(@Param('id') id: string, @CompanyId() companyId: string, @CurrentUser() user: JwtUser, @Body() dto: CreateLoanPaymentDto) { return this.service.pay(id, companyId, dto, user.sub); }
  @Post(':id/payments/:paymentId/reverse') @RequirePermission('EXPENSES_WRITE') reverse(@Param('id') id: string, @Param('paymentId') paymentId: string, @CompanyId() companyId: string, @CurrentUser() user: JwtUser, @Body() dto: ReverseLoanPaymentDto) { return this.service.reversePayment(id, paymentId, companyId, dto, user.sub); }
}

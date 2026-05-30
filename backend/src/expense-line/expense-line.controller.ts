/**
 * ExpenseLineController — بنود المصاريف الثابتة والمتغيرة
 */
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { ExpenseLineService } from './expense-line.service';
import { CreateExpenseLineDto } from './dto/create-expense-line.dto';
import { UpdateExpenseLineDto } from './dto/update-expense-line.dto';

@Controller('expense-lines')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class ExpenseLineController {
  constructor(private readonly expenseLineService: ExpenseLineService) {}

  @Get()
  @RequireAnyPermission(
    'INVOICES_READ',
    'EXPENSES_READ',
    'CHAT_PRESET_EXPENSE_ADD',
    'CHAT_PRESET_EXPENSE_PAY',
    'CHAT_PRESET_EXPENSE_EDIT',
  )
  findAll(
    @CompanyId() companyId: string,
    @Query('kind') kind?: 'fixed_expense' | 'expense',
    @Query('includeInactive') includeInactive?: string,
  ) {
    if (!companyId) return [];
    return this.expenseLineService.findAll(
      companyId,
      kind,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  @RequireAnyPermission(
    'INVOICES_READ',
    'EXPENSES_READ',
    'CHAT_PRESET_EXPENSE_ADD',
    'CHAT_PRESET_EXPENSE_PAY',
    'CHAT_PRESET_EXPENSE_EDIT',
  )
  findOne(
    @Param('id') id: string,
    @CompanyId() companyId: string,
  ) {
    return this.expenseLineService.findOne(id, companyId);
  }

  @Get(':id/payments')
  @RequirePermission('INVOICES_READ')
  getPayments(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.expenseLineService.getPayments(
      id,
      companyId,
      startDate,
      endDate,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
    );
  }

  @Post()
  @RequireAnyPermission('INVOICES_WRITE', 'EXPENSES_WRITE', 'CHAT_PRESET_EXPENSE_ADD')
  create(@Body() dto: CreateExpenseLineDto) {
    return this.expenseLineService.create(dto);
  }

  @Patch(':id')
  @RequireAnyPermission('INVOICES_WRITE', 'EXPENSES_WRITE', 'CHAT_PRESET_EXPENSE_EDIT')
  update(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() dto: UpdateExpenseLineDto,
  ) {
    return this.expenseLineService.update(id, companyId, dto);
  }

  @Patch(':id/deactivate')
  @RequirePermission('INVOICES_WRITE')
  deactivate(
    @Param('id') id: string,
    @CompanyId() companyId: string,
  ) {
    return this.expenseLineService.deactivate(id, companyId);
  }
}

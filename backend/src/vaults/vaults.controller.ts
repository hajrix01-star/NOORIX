/**
 * VaultsController — إدارة الخزائن
 */
import {
  BadRequestException, Body, Controller,
  Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ZodError } from 'zod';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { createVaultSchema, reorderVaultsSchema, updateVaultSchema } from './dto/create-vault.dto';
import { vaultTransferSchema } from './dto/vault-transfer.dto';
import { VaultsService } from './vaults.service';

@Controller('vaults')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class VaultsController {
  constructor(private readonly vaultsService: VaultsService) {}

  @Get()
  @RequirePermission('VAULTS_READ')
  async findAll(
    @CompanyId() companyId: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('startDate')      startDate?:      string,
    @Query('endDate')        endDate?:        string,
  ) {
    if (!companyId) return [];
    return this.vaultsService.findAll(
      companyId,
      includeArchived === 'true',
      startDate,
      endDate,
    );
  }

  @Get('sales-channels')
  async findSalesChannels(@CompanyId() companyId: string) {
    if (!companyId) return [];
    return this.vaultsService.findSalesChannels(companyId);
  }

  @Get('payment-options')
  async findPaymentOptions(@CompanyId() companyId: string) {
    if (!companyId) return [];
    return this.vaultsService.findPaymentOptions(companyId);
  }

  @Post('transfer')
  @RequirePermission('VAULTS_WRITE')
  async transfer(
    @Body() body: unknown,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    try {
      const dto = vaultTransferSchema.parse({
        ...(typeof body === 'object' && body !== null ? body : {}),
        companyId: companyId || (body as { companyId?: string })?.companyId,
      });
      if (!dto.companyId?.trim()) {
        throw new BadRequestException('معرف الشركة مطلوب (companyId في الطلب أو الرأس)');
      }
      return this.vaultsService.transfer(dto, user.sub);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException(e.errors?.[0]?.message ?? 'بيانات التحويل غير صحيحة');
      }
      throw e;
    }
  }

  @Get(':id/transactions')
  @RequirePermission('VAULTS_READ')
  async findTransactions(
    @Param('id')     id:               string,
    @CompanyId()    companyId:        string,
    @Query('startDate')  startDate?:  string,
    @Query('endDate')    endDate?:    string,
    @Query('page')       page?:      string,
    @Query('pageSize')  pageSize?:  string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required for vault transactions');
    }
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const size = Math.min(10000, Math.max(1, parseInt(pageSize ?? '50', 10) || 50));
    return this.vaultsService.findOneWithTransactions(
      id,
      companyId,
      startDate as string,
      endDate as string,
      pageNum,
      size,
    );
  }

  @Patch('reorder')
  @RequirePermission('VAULTS_WRITE')
  async reorderVaults(
    @Body()         body:             unknown,
    @CompanyId()   companyId:         string,
  ) {
    if (!companyId) {
      throw new BadRequestException('معرف الشركة مطلوب');
    }
    try {
      const dto = reorderVaultsSchema.parse(body);
      return this.vaultsService.reorder(companyId, dto.vaultIds);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException(e.errors?.[0]?.message ?? 'بيانات الترتيب غير صحيحة');
      }
      throw e;
    }
  }

  @Post()
  @RequirePermission('VAULTS_WRITE')
  async create(
    @Body()        body: unknown,
    @CurrentUser() user: JwtUser,
  ) {
    try {
      const dto = createVaultSchema.parse(body);
      return this.vaultsService.create(dto, user.sub);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException(e.errors?.[0]?.message ?? 'بيانات غير صحيحة');
      }
      throw e;
    }
  }

  @Patch(':id')
  @RequirePermission('VAULTS_WRITE')
  async update(
    @Param('id')   id:       string,
    @CompanyId()  companyId: string,
    @Body()      body:     unknown,
    @CurrentUser() user:   JwtUser,
  ) {
    try {
      const dto = updateVaultSchema.parse(body);
      return this.vaultsService.update(id, companyId, dto, user.sub);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException(e.errors?.[0]?.message ?? 'بيانات غير صحيحة');
      }
      throw e;
    }
  }

  @Patch(':id/archive')
  @RequirePermission('VAULTS_WRITE')
  async archive(
    @Param('id')   id:        string,
    @CompanyId()  companyId:  string,
    @CurrentUser() user:     JwtUser,
  ) {
    return this.vaultsService.archive(id, companyId, user.sub);
  }

  @Delete(':id')
  @RequirePermission('VAULTS_DELETE')
  async remove(
    @Param('id')   id:        string,
    @CompanyId()  companyId:  string,
    @CurrentUser() user:     JwtUser,
  ) {
    return this.vaultsService.remove(id, companyId, user.sub);
  }
}

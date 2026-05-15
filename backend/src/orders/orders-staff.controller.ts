import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { OrdersService } from './orders.service';
import { CreateStaffOrderDto, MarkStaffDigestDto, UpdateStaffOrderDto } from './dto/create-staff-order.dto';

type JwtUser = { userId?: string; sub?: string };

/**
 * مسارات طلبات الموظفين تحت `orders/staff` — منفصلة عن `orders/:id` لتفادي أي تعارض في التوجيه.
 */
@Controller('orders/staff')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class OrdersStaffController {
  constructor(private readonly ordersService: OrdersService) {}

  private uid(req: { user?: JwtUser }): string {
    return req.user?.userId || req.user?.sub || '';
  }

  @Get('my')
  @RequirePermission('ORDERS_STAFF_PORTAL')
  listStaffMine(
    @CompanyId() companyId: string,
    @Req() req: { user?: JwtUser },
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const uid = this.uid(req);
    if (!companyId || !uid || !year || !month) return [];
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!y || !m || m < 1 || m > 12) return [];
    return this.ordersService.listStaffOwnRequests(companyId, uid, y, m);
  }

  @Post()
  @RequirePermission('ORDERS_STAFF_PORTAL')
  createStaff(@CompanyId() companyId: string, @Req() req: { user?: JwtUser }, @Body() body: CreateStaffOrderDto) {
    return this.ordersService.createStaffRequest(companyId, this.uid(req), body);
  }

  @Patch(':id')
  @RequirePermission('ORDERS_STAFF_PORTAL')
  updateStaff(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Req() req: { user?: JwtUser },
    @Body() body: UpdateStaffOrderDto,
  ) {
    return this.ordersService.updateStaffRequest(companyId, this.uid(req), id, body);
  }

  @Delete(':id')
  @RequirePermission('ORDERS_STAFF_PORTAL')
  cancelStaff(@Param('id') id: string, @CompanyId() companyId: string, @Req() req: { user?: JwtUser }) {
    return this.ordersService.cancelStaffOwnRequest(companyId, this.uid(req), id);
  }

  @Post('mark-digest-sent')
  @RequirePermission('ORDERS_WRITE')
  markStaffDigest(@Body() body: MarkStaffDigestDto) {
    return this.ordersService.markStaffDigestSent(body.companyId, body.orderIds);
  }
}

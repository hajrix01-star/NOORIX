import { Controller, Get, Inject, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TenantContext } from '../common/tenant-context';
import { AdminDashboardTokenGuard } from './admin-dashboard-token.guard';
import { OwnerAdminDashboardService } from './owner-admin-dashboard.service';

@Controller('owner/admin-dashboard')
@UseGuards(AdminDashboardTokenGuard)
export class OwnerAdminDashboardController {
  constructor(@Inject(OwnerAdminDashboardService) private readonly service: OwnerAdminDashboardService) {}

  @Get()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  getSnapshot() {
    const tenantId = process.env.ADMIN_DASHBOARD_TENANT_ID?.trim();
    if (!tenantId) throw new UnauthorizedException('ADMIN_DASHBOARD_NOT_CONFIGURED');
    return new Promise((resolve, reject) => {
      TenantContext.run(tenantId, null, () => this.service.getSnapshot(tenantId).then(resolve, reject));
    });
  }
}

import { Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { SkipCompanyCheck } from '../auth/decorators/skip-company-check.decorator';
import { BackupService } from './backup.service';
import { TriggerBackupDto } from './dto/trigger-backup.dto';

type ReqUser = {
  userId?: string;
  tenantId?: string;
  companyIds?: string[];
  role?: string;
};

@Controller('backup')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
@SkipCompanyCheck()
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('trigger')
  @RequirePermission('MANAGE_SETTINGS')
  async trigger(@Body() dto: TriggerBackupDto, @Req() req: { user?: ReqUser }) {
    const u = req.user;
    if (!u?.tenantId || !u.userId) throw new UnauthorizedException();
    return this.backupService.triggerCompanyLogicalBackup({
      tenantId: u.tenantId,
      userId: u.userId,
      companyId: dto.companyId,
      allowedCompanyIds: u.companyIds,
    });
  }

  @Get('jobs')
  @RequirePermission('MANAGE_SETTINGS')
  async listJobs(@Req() req: { user?: ReqUser }, @Query('limit') limit?: string) {
    const u = req.user;
    if (!u?.tenantId) throw new UnauthorizedException();
    const jobs = await this.backupService.listJobs(u.tenantId, u.companyIds, limit ? parseInt(limit, 10) : 40);
    return jobs.map((j) => ({
      ...j,
      sizeBytes: j.sizeBytes != null ? j.sizeBytes.toString() : null,
    }));
  }

  @Get('jobs/:id/restore-report')
  @RequirePermission('MANAGE_SETTINGS')
  async restoreReport(@Param('id') id: string, @Req() req: { user?: ReqUser }) {
    const u = req.user;
    if (!u?.tenantId) throw new UnauthorizedException();
    return this.backupService.getRestoreReport(u.tenantId, id, u.companyIds);
  }

  @Post('jobs/:id/retry-external')
  @RequirePermission('MANAGE_SETTINGS')
  async retryExternal(@Param('id') id: string, @Req() req: { user?: ReqUser }) {
    const u = req.user;
    if (!u?.tenantId) throw new UnauthorizedException();
    return this.backupService.retryExternalUpload(u.tenantId, id, u.companyIds);
  }
}

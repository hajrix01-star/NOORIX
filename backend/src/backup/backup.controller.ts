import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { SkipCompanyCheck } from '../auth/decorators/skip-company-check.decorator';
import { BackupService } from './backup.service';
import { BackupLogicalImportService } from './backup-logical-import.service';
import { TriggerBackupDto } from './dto/trigger-backup.dto';
import { ImportBackupDto } from './dto/import-backup.dto';
import { UpdateSystemBackupConfigDto } from './dto/update-system-backup-config.dto';
import { Roles } from '../auth/decorators/roles.decorator';

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
  constructor(
    private readonly backupService: BackupService,
    private readonly backupImportService: BackupLogicalImportService,
  ) {}

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

  @Get('system/config')
  @Roles('owner', 'super_admin')
  async getSystemBackupConfig(@Req() req: { user?: ReqUser }) {
    if (!req.user?.tenantId) throw new UnauthorizedException();
    return this.backupService.getSystemBackupConfig();
  }

  @Patch('system/config')
  @Roles('owner', 'super_admin')
  async patchSystemBackupConfig(
    @Body() dto: UpdateSystemBackupConfigDto,
    @Req() req: { user?: ReqUser },
  ) {
    if (!req.user?.tenantId) throw new UnauthorizedException();
    const row = await this.backupService.updateSystemBackupConfig(dto);
    return {
      enabled: row.enabled,
      scheduleHour: row.scheduleHour,
      scheduleMinute: row.scheduleMinute,
      retentionCount: row.retentionCount,
      timezone: row.timezone,
      lastRunDayRiyadh: row.lastRunDayRiyadh,
    };
  }

  @Get('system/jobs')
  @Roles('owner', 'super_admin')
  async listSystemJobs(@Req() req: { user?: ReqUser }, @Query('limit') limit?: string) {
    if (!req.user?.tenantId) throw new UnauthorizedException();
    const jobs = await this.backupService.listSystemFullJobs(limit ? parseInt(limit, 10) : 20);
    return jobs.map((j) => ({
      ...j,
      sizeBytes: j.sizeBytes != null ? j.sizeBytes.toString() : null,
    }));
  }

  @Post('system/run-now')
  @Roles('owner', 'super_admin')
  async runSystemBackupNow(@Req() req: { user?: ReqUser }) {
    if (!req.user?.tenantId) throw new UnauthorizedException();
    const cfg = await this.backupService.getSystemBackupConfig();
    return this.backupService.runFullDatabaseBackup({
      manual: true,
      retentionCount: cfg.retentionCount,
    });
  }

  @Post('system/jobs/:id/verify')
  @Roles('owner', 'super_admin')
  async verifySystemJob(@Param('id') id: string, @Req() req: { user?: ReqUser }) {
    if (!req.user?.tenantId) throw new UnauthorizedException();
    return this.backupService.verifyDatabaseFullJob(id);
  }

  @Post('jobs/:id/verify')
  @RequirePermission('MANAGE_SETTINGS')
  async verifyCompanyJob(@Param('id') id: string, @Req() req: { user?: ReqUser }) {
    const u = req.user;
    if (!u?.tenantId) throw new UnauthorizedException();
    return this.backupService.verifyCompanyLogicalJob(u.tenantId, id, u.companyIds);
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

  @Get('jobs/:id/download')
  @RequirePermission('MANAGE_SETTINGS')
  async download(@Param('id') id: string, @Req() req: { user?: ReqUser }): Promise<StreamableFile> {
    const u = req.user;
    if (!u?.tenantId) throw new UnauthorizedException();
    const { absolutePath, filename } = await this.backupService.resolveJobDownloadPath(
      u.tenantId,
      id,
      u.companyIds,
    );
    const stream = createReadStream(absolutePath);
    return new StreamableFile(stream, {
      type: 'application/gzip',
      disposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    });
  }

  @Post('import')
  @RequirePermission('MANAGE_SETTINGS')
  async importFromJob(@Body() dto: ImportBackupDto, @Req() req: { user?: ReqUser }) {
    const u = req.user;
    if (!u?.tenantId || !u.userId) throw new UnauthorizedException();
    const snapshot = await this.backupService.loadParsedSnapshotForImport(
      u.tenantId,
      dto.jobId,
      u.companyIds,
    );
    return this.backupImportService.importIntoNewCompany({
      snapshot,
      tenantId: u.tenantId,
      nameAr: dto.nameAr,
      nameEn: dto.nameEn,
      importingUserId: u.userId,
    });
  }
}

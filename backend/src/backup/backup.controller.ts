import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import * as os from 'os';
import * as path from 'path';
import { diskStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { UpdateCompanyBackupConfigDto } from './dto/update-company-backup-config.dto';
import { RestoreFullBackupDto } from './dto/restore-full-backup.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

function fullDumpUploadMaxBytes(): number {
  const mb = parseInt(process.env.BACKUP_FULL_UPLOAD_MAX_MB || '3072', 10);
  const clamped = Math.min(Math.max(Number.isFinite(mb) ? mb : 3072, 32), 8192);
  return clamped * 1024 * 1024;
}

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
      gdriveScriptUrl: row.gdriveScriptUrl ?? null,
      gdriveFolderId: row.gdriveFolderId ?? null,
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

  /** رفع نسخة قاعدة كاملة (.dump.gz) من جهاز المستخدم — يتحقق منها ثم يضيفها للسجل */
  @Post('system/upload-full-dump')
  @Roles('owner', 'super_admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dest = path.join(os.tmpdir(), 'noorix-full-dump-upload');
          mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (_req, _file, cb) => {
          cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}.part`);
        },
      }),
      limits: { fileSize: fullDumpUploadMaxBytes() },
    }),
  )
  async uploadSystemFullDump(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: JwtUser) {
    if (!file?.path) throw new BadRequestException('لم يُرفع ملف');
    const uid = user?.sub || user?.userId;
    const result = await this.backupService.ingestUploadedFullDatabaseDump({
      tempPath: file.path,
      originalFilename: file.originalname,
      userId: uid,
    });
    return { success: true, data: result };
  }

  @Get('system/jobs/:id/download')
  @Roles('owner', 'super_admin')
  async downloadSystemFullJob(@Param('id') id: string, @Req() req: { user?: ReqUser }): Promise<StreamableFile> {
    if (!req.user?.tenantId) throw new UnauthorizedException();
    const { absolutePath, filename } = await this.backupService.resolveSystemFullJobDownloadPath(id);
    const stream = createReadStream(absolutePath);
    return new StreamableFile(stream, {
      type: 'application/gzip',
      disposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    });
  }

  @Post('system/jobs/:id/verify')
  @Roles('owner', 'super_admin')
  async verifySystemJob(@Param('id') id: string, @Req() req: { user?: ReqUser }) {
    if (!req.user?.tenantId) throw new UnauthorizedException();
    return this.backupService.verifyDatabaseFullJob(id);
  }

  @Post('system/jobs/:id/restore')
  @Roles('owner', 'super_admin')
  async restoreSystemFull(
    @Param('id') id: string,
    @Body() dto: RestoreFullBackupDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const result = await this.backupService.restoreDatabaseFullJob(id, dto.confirmPhrase);
    res.json(result);
    if (result.exitAfter) {
      res.once('finish', () => {
        setTimeout(() => process.exit(0), 500);
      });
    }
  }

  @Get('company/config')
  @RequirePermission('MANAGE_SETTINGS')
  async getCompanyBackupConfig(@Query('companyId') companyId: string, @Req() req: { user?: ReqUser }) {
    const u = req.user;
    if (!u?.tenantId) throw new UnauthorizedException();
    if (!companyId) throw new BadRequestException('companyId مطلوب');
    if (u.companyIds?.length && !u.companyIds.includes(companyId)) {
      throw new ForbiddenException('لا يمكنك إدارة نسخ هذه الشركة');
    }
    return this.backupService.getCompanyBackupConfig(u.tenantId, companyId);
  }

  @Patch('company/config')
  @RequirePermission('MANAGE_SETTINGS')
  async patchCompanyBackupConfig(@Body() dto: UpdateCompanyBackupConfigDto, @Req() req: { user?: ReqUser }) {
    const u = req.user;
    if (!u?.tenantId) throw new UnauthorizedException();
    if (u.companyIds?.length && !u.companyIds.includes(dto.companyId)) {
      throw new ForbiddenException('لا يمكنك إدارة نسخ هذه الشركة');
    }
    return this.backupService.upsertCompanyBackupConfig(u.tenantId, dto);
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

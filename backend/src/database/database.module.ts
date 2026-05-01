import { Global, Module } from '@nestjs/common';
import { DatabaseBootstrapService } from './database-bootstrap.service';
import { PermissionCacheModule } from '../auth/permission-cache.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule, PermissionCacheModule],
  providers: [DatabaseBootstrapService],
  exports: [DatabaseBootstrapService],
})
export class DatabaseModule {}

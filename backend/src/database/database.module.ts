import { Global, Module } from '@nestjs/common';
import { DatabaseBootstrapService } from './database-bootstrap.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [DatabaseBootstrapService],
  exports: [DatabaseBootstrapService],
})
export class DatabaseModule {}

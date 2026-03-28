import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { connectPrismaWithRetry } from './prisma-connect-retry';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await connectPrismaWithRetry(() => this.$connect(), PrismaService.name);
      this.logger.log('اتصال قاعدة البيانات نجح');
    } catch (err) {
      this.logger.error('فشل اتصال قاعدة البيانات بعد كل المحاولات:', err);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

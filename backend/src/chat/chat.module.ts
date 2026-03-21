import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ReportsModule } from '../reports/reports.module';
import { VaultsModule } from '../vaults/vaults.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { GeminiService } from './gemini.service';

@Module({
  imports: [PrismaModule, AuthModule, ReportsModule, VaultsModule],
  controllers: [ChatController],
  providers: [ChatService, GeminiService],
  exports: [GeminiService],
})
export class ChatModule {}

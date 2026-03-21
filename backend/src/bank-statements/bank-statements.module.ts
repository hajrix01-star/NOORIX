import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BankStatementsController } from './bank-statements.controller';
import { BankStatementsService } from './bank-statements.service';

@Module({
  imports: [PrismaModule, AuthModule, ChatModule],
  controllers: [BankStatementsController],
  providers: [BankStatementsService],
  exports: [BankStatementsService],
})
export class BankStatementsModule {}

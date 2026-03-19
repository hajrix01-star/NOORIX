import { Module } from '@nestjs/common';
import { ExpenseLineController } from './expense-line.controller';
import { ExpenseLineService } from './expense-line.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ExpenseLineController],
  providers: [ExpenseLineService],
  exports: [ExpenseLineService],
})
export class ExpenseLineModule {}

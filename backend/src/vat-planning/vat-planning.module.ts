import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VatPlanningController } from './vat-planning.controller';
import { VatPlanningService } from './vat-planning.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [VatPlanningController],
  providers: [VatPlanningService],
})
export class VatPlanningModule {}

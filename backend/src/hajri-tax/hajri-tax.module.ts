import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HajriTaxController } from './hajri-tax.controller';

@Module({
  imports: [AuthModule],
  controllers: [HajriTaxController],
})
export class HajriTaxModule {}

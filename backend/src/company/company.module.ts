import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountingInitModule } from '../accounting-init/accounting-init.module';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

@Module({
  imports: [AuthModule, AccountingInitModule],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}

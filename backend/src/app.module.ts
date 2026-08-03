import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController }    from './app.controller';
import { AppService }       from './app.service';
import { AccountingInitModule } from './accounting-init/accounting-init.module';
import { SupplierDirectoryModule } from './supplier-directory/supplier-directory.module';
import { AccountsModule }   from './accounts/accounts.module';
import { AuditModule }      from './audit/audit.module';
import { AuthModule }       from './auth/auth.module';
import { CompanyModule }    from './company/company.module';
import { InvoiceModule }    from './invoice/invoice.module';
import { PrismaModule }     from './prisma/prisma.module';
import { SuppliersModule }  from './suppliers/suppliers.module';
import { UsersModule }      from './users/users.module';
import { VaultsModule }     from './vaults/vaults.module';
import { RolesModule }      from './roles/roles.module';
import { LedgerModule }     from './ledger/ledger.module';
import { SalesModule }      from './sales/sales.module';
import { CategoriesModule }  from './categories/categories.module';
import { EmployeesModule }   from './employees/employees.module';
import { HRModule }         from './hr/hr.module';
import { FinancialCoreModule } from './financial-core/financial-core.module';
import { FiscalPeriodModule }  from './fiscal-period/fiscal-period.module';
import { VaultBalanceModule }  from './vault-balance/vault-balance.module';
import { IdempotencyModule }   from './idempotency/idempotency.module';
import { ExpenseLineModule }   from './expense-line/expense-line.module';
import { ReportsModule }       from './reports/reports.module';
import { ReportingModule }     from './reporting/reporting.module';
import { ChatModule }          from './chat/chat.module';
import { BankStatementsModule } from './bank-statements/bank-statements.module';
import { OrdersV4Module }       from './orders-v4/orders-v4.module';
import { DatabaseModule }       from './database/database.module';
import { BackupModule }         from './backup/backup.module';
import { CompanyAssetsModule } from './company-assets/company-assets.module';
import { VatPlanningModule } from './vat-planning/vat-planning.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { OwnerModule } from './owner/owner.module';
import { PermissionCacheModule } from './auth/permission-cache.service';
import { TenantMiddleware }    from './common/tenant.middleware';
import { JwtModule }           from '@nestjs/jwt';
import { getJwtSecret }        from './config/jwt.config';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    // Rate Limiting: 120 طلب / 60 ثانية لكل IP
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 120,
    }]),
    PrismaModule,
    PermissionCacheModule,
    DatabaseModule,
    AccountingInitModule,
    SupplierDirectoryModule,
    AccountsModule,
    AuditModule,
    AuthModule,
    CompanyModule,
    InvoiceModule,
    VaultsModule,
    SuppliersModule,
    UsersModule,
    RolesModule,
    LedgerModule,
    SalesModule,
    CategoriesModule,
    EmployeesModule,
    HRModule,
    FinancialCoreModule,
    FiscalPeriodModule,
    VaultBalanceModule,
    IdempotencyModule,
    ExpenseLineModule,
    ReportsModule,
    ReportingModule,
    ChatModule,
    BankStatementsModule,
    OrdersV4Module,
    BackupModule,
    CompanyAssetsModule,
    VatPlanningModule,
    DashboardModule,
    OwnerModule,
    JwtModule.register({ secret: getJwtSecret() }),
  ],
  controllers: [AppController],
  providers:   [
    AppService,
    TenantMiddleware,
    // Rate Limiting Guard عالمي
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // TenantMiddleware يعمل على جميع المسارات — يُطلق AsyncLocalStorage context
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}


import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController }    from './app.controller';
import { AppService }       from './app.service';
import { AccountingInitModule } from './accounting-init/accounting-init.module';
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
import { ChatModule }          from './chat/chat.module';
import { OrdersModule }         from './orders/orders.module';
import { DatabaseModule }       from './database/database.module';
import { TenantMiddleware }    from './common/tenant.middleware';
import { JwtModule }           from '@nestjs/jwt';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    DatabaseModule,
    AccountingInitModule,
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
    ChatModule,
    OrdersModule,
    // JWT Module لـ TenantMiddleware (قراءة التوكن)
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'noorix-dev-secret' }),
  ],
  controllers: [AppController],
  providers:   [AppService, TenantMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // TenantMiddleware يعمل على جميع المسارات — يُطلق AsyncLocalStorage context
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}

import { Module }            from '@nestjs/common';
import { PrismaModule }      from '../prisma/prisma.module';
import { AuthModule }        from '../auth/auth.module';
import { AuditModule }       from '../audit/audit.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService }    from './employees.service';

@Module({
  imports:     [PrismaModule, AuthModule, AuditModule],
  controllers: [EmployeesController],
  providers:   [EmployeesService],
  exports:     [EmployeesService],
})
export class EmployeesModule {}

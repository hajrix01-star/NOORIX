import { Module }        from '@nestjs/common';
import { JwtModule }    from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController }    from './auth.controller';
import { AuthService }       from './auth.service';
import { CompanyAccessGuard } from './guards/company-access.guard';
import { RolesGuard }        from './guards/roles.guard';
import { JwtStrategy }       from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret:      process.env.JWT_SECRET ?? 'noorix-dev-secret-change-in-production',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' },
    }),
  ],
  controllers: [AuthController],
  providers:   [AuthService, JwtStrategy, RolesGuard, CompanyAccessGuard],
  exports:     [AuthService, RolesGuard, CompanyAccessGuard, JwtModule],
})
export class AuthModule {}

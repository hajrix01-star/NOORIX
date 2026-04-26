import { Module, Logger }        from '@nestjs/common';
import { JwtModule }    from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController }    from './auth.controller';
import { AuthService }       from './auth.service';
import { CompanyAccessGuard } from './guards/company-access.guard';
import { RolesGuard }        from './guards/roles.guard';
import { JwtStrategy }       from './jwt.strategy';
import { JWT_DEV_FALLBACK } from '../config/jwt.config';

const secretFromEnv = process.env.JWT_SECRET;
if (!secretFromEnv) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('❌ JWT_SECRET يجب تحديده في بيئة الإنتاج.');
  }
  new Logger('AuthModule').warn('⚠️ JWT_SECRET غير محدد — يُستخدم secret افتراضي (للتطوير فقط)');
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret:      secretFromEnv || JWT_DEV_FALLBACK,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' },
    }),
  ],
  controllers: [AuthController],
  providers:   [AuthService, JwtStrategy, RolesGuard, CompanyAccessGuard],
  exports:     [AuthService, RolesGuard, CompanyAccessGuard, JwtModule],
})
export class AuthModule {}

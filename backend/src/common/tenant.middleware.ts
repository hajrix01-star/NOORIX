/**
 * TenantMiddleware — يُطلق TenantContext في بداية كل HTTP request.
 *
 * يستخرج tenantId + userId من JWT token المُحلَّل مسبقاً،
 * ثم يُشغّل بقية المعالجة داخل AsyncLocalStorage context.
 *
 * الترتيب: JWT Passport Strategy → TenantMiddleware → Controllers
 */
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction }                   from 'express';
import { JwtService }                                        from '@nestjs/jwt';
import { TenantContext }                                     from './tenant-context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // استخراج token من Authorization header
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      // مسارات غير محمية (login, health) — نكمل بدون context
      return next();
    }

    try {
      const token   = authHeader.slice(7);
      const payload = this.jwtService.verify<{
        sub: string;
        tenantId: string;
        companyIds: string[];
      }>(token, { secret: process.env.JWT_SECRET });

      const tenantId = payload?.tenantId;
      const userId   = payload?.sub ?? null;

      if (!tenantId) {
        // token صالح لكن بدون tenantId (tokens قديمة) — رفض صريح
        throw new UnauthorizedException(
          'التوكين منتهي الصلاحية أو غير مكتمل. يُرجى تسجيل الدخول مجدداً.',
        );
      }

      // تشغيل بقية الـ request داخل TenantContext
      TenantContext.run(tenantId, userId, () => next());
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      next();
    }
  }
}

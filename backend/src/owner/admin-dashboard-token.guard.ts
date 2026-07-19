import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

type RequestWithAuthorization = {
  headers?: { authorization?: string | string[] };
};

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

@Injectable()
export class AdminDashboardTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const configuredHash = process.env.ADMIN_DASHBOARD_TOKEN_SHA256?.trim().toLowerCase();
    if (!configuredHash || !/^[a-f0-9]{64}$/.test(configuredHash)) {
      throw new UnauthorizedException('ADMIN_DASHBOARD_NOT_CONFIGURED');
    }

    const request = context.switchToHttp().getRequest<RequestWithAuthorization>();
    const header = request.headers?.authorization;
    const authorization = Array.isArray(header) ? header[0] : header;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('UNAUTHORIZED');

    const actual = sha256(token);
    const expected = Buffer.from(configuredHash, 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }
    return true;
  }
}

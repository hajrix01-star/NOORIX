import type { ExecutionContext } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AdminDashboardTokenGuard } from './admin-dashboard-token.guard';

function context(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  } as unknown as ExecutionContext;
}

describe('AdminDashboardTokenGuard', () => {
  const previousHash = process.env.ADMIN_DASHBOARD_TOKEN_SHA256;

  afterEach(() => {
    if (previousHash === undefined) delete process.env.ADMIN_DASHBOARD_TOKEN_SHA256;
    else process.env.ADMIN_DASHBOARD_TOKEN_SHA256 = previousHash;
  });

  it('accepts only the token matching the configured SHA-256 digest', () => {
    const token = 'a-production-length-read-only-token';
    process.env.ADMIN_DASHBOARD_TOKEN_SHA256 = createHash('sha256').update(token).digest('hex');
    expect(new AdminDashboardTokenGuard().canActivate(context(`Bearer ${token}`))).toBe(true);
  });

  it('rejects a different token', () => {
    process.env.ADMIN_DASHBOARD_TOKEN_SHA256 = createHash('sha256').update('expected').digest('hex');
    expect(() => new AdminDashboardTokenGuard().canActivate(context('Bearer different'))).toThrow('UNAUTHORIZED');
  });
});

import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from './decorators/require-permission.decorator';
import { hasPermission, SYSTEM_ROLE_SEEDS } from './constants/permissions';
import { PermissionCacheService } from './permission-cache.service';
import { RolesGuard } from './guards/roles.guard';
import { BankStatementsController } from '../bank-statements/bank-statements.controller';
import { DashboardController } from '../dashboard/dashboard.controller';
import { SuppliersController } from '../suppliers/suppliers.controller';

function requiredPermission(target: object, method: string): string | undefined {
  const handler = (target as Record<string, unknown>)[method];
  if (typeof handler !== 'function') return undefined;
  return Reflect.getMetadata(
    PERMISSION_KEY,
    handler,
  );
}

function guardFor(permissions: string[]): RolesGuard {
  const permissionCache = {
    getPermissions: jest.fn().mockResolvedValue(permissions),
  } as unknown as PermissionCacheService;
  return new RolesGuard(new Reflector(), permissionCache);
}

function contextFor(
  handler: Function,
  target: Function,
  role = 'codex_readonly',
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { role, permissions: [] } }),
    }),
    getHandler: () => handler,
    getClass: () => target,
  } as unknown as ExecutionContext;
}

describe('read-only permission boundaries', () => {
  it('puts every bank-statement mutation behind the dedicated write permission', () => {
    const mutations = [
      'upload', 'suggestHeaderMetadata', 'reclassify', 'confirmMapping',
      'setTemplateIsActive', 'deleteTemplate', 'createTreeCategory',
      'updateTreeCategory', 'deleteTreeCategory', 'seedDefaultTreeCategories',
      'createRule', 'deleteRule', 'importClassificationPack',
      'importClassificationFromCompany', 'updateTxCategory', 'updateTxNote',
      'delete', 'createCategory', 'deleteCategory',
    ];

    for (const method of mutations) {
      expect(requiredPermission(BankStatementsController.prototype, method)).toBe('BANK_STATEMENTS_WRITE');
    }
  });

  it('puts every dashboard calendar mutation behind the dedicated write permission', () => {
    const mutations = [
      'putCalendarTargets', 'resetCalendarTargets', 'applySaudiOccasions',
      'applySchoolAcademicHolidays', 'putCalendarSpecialDays', 'putCalendarDayNotes',
    ];

    for (const method of mutations) {
      expect(requiredPermission(DashboardController.prototype, method)).toBe('DASHBOARD_CALENDAR_WRITE');
    }
  });

  it('requires an explicit supplier bookmark write permission', () => {
    expect(requiredPermission(SuppliersController.prototype, 'setBookmark')).toBe('SUPPLIERS_BOOKMARK_WRITE');
  });

  it('returns 403 for every separated mutation while preserving read endpoints', async () => {
    const readOnlyGuard = guardFor(['REPORTS_READ', 'VIEW_DASHBOARD', 'SUPPLIERS_READ']);
    const bankPrototype = BankStatementsController.prototype as unknown as Record<string, Function>;
    const dashboardPrototype = DashboardController.prototype as unknown as Record<string, Function>;
    const supplierPrototype = SuppliersController.prototype as unknown as Record<string, Function>;
    const bankMutations = [
      'upload', 'suggestHeaderMetadata', 'reclassify', 'confirmMapping',
      'setTemplateIsActive', 'deleteTemplate', 'createTreeCategory',
      'updateTreeCategory', 'deleteTreeCategory', 'seedDefaultTreeCategories',
      'createRule', 'deleteRule', 'importClassificationPack',
      'importClassificationFromCompany', 'updateTxCategory', 'updateTxNote',
      'delete', 'createCategory', 'deleteCategory',
    ];
    const calendarMutations = [
      'putCalendarTargets', 'resetCalendarTargets', 'applySaudiOccasions',
      'applySchoolAcademicHolidays', 'putCalendarSpecialDays', 'putCalendarDayNotes',
    ];

    for (const method of bankMutations) {
      await expect(readOnlyGuard.canActivate(contextFor(bankPrototype[method], BankStatementsController)))
        .rejects.toBeInstanceOf(ForbiddenException);
    }
    for (const method of calendarMutations) {
      await expect(readOnlyGuard.canActivate(contextFor(dashboardPrototype[method], DashboardController)))
        .rejects.toBeInstanceOf(ForbiddenException);
    }
    await expect(readOnlyGuard.canActivate(
      contextFor(supplierPrototype.setBookmark, SuppliersController),
    )).rejects.toBeInstanceOf(ForbiddenException);
    await expect(readOnlyGuard.canActivate(
      contextFor(bankPrototype.list, BankStatementsController),
    )).resolves.toBe(true);
  });

  it('keeps the system owner and super-admin authorized for the new write boundaries', () => {
    for (const role of ['owner', 'super_admin']) {
      expect(hasPermission(role, 'BANK_STATEMENTS_WRITE', [])).toBe(true);
      expect(hasPermission(role, 'DASHBOARD_CALENDAR_WRITE', [])).toBe(true);
      expect(hasPermission(role, 'SUPPLIERS_BOOKMARK_WRITE', [])).toBe(true);
    }
    expect(SYSTEM_ROLE_SEEDS['accountant'].permissions).toEqual(expect.arrayContaining([
      'BANK_STATEMENTS_WRITE', 'DASHBOARD_CALENDAR_WRITE', 'SUPPLIERS_BOOKMARK_WRITE',
    ]));
  });
});

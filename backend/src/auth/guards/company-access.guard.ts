/**
 * CompanyAccessGuard — يتحقق أن المستخدم يملك صلاحية الوصول للشركة المطلوبة.
 *
 * ترتيب استخراج companyId (من الأعلى أولويةً):
 *   1. body.companyId    (POST/PATCH)
 *   2. params.companyId  (GET)
 *   3. query.companyId   (GET)
 *   4. x-company-id header (standard header)
 *
 * التحققات:
 *   - المستخدم مرتبط بالشركة (user.companyIds)
 *   - الشركة موجودة وتنتمي لـ tenant المستخدم (RLS)
 *
 * استثناءات: Endpoints مُعلَّمة بـ @SkipCompanyCheck() تمر دون فحص.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { TenantContext } from '../../common/tenant-context';
import { isSuperAdmin }              from '../constants/permissions';
import { SKIP_COMPANY_CHECK_KEY }    from '../decorators/skip-company-check.decorator';

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: TenantPrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user    = request.user;

    if (!user) return false;

    // ── هل الـ endpoint مُعفى صراحةً؟ ──────────────────────
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_COMPANY_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    // ── Super Admin / Owner يرون جميع شركات الـ Tenant ─────
    const role = (user.role || '').toLowerCase();
    if (isSuperAdmin(role)) return true;

    // ── استخراج companyId من المصادر الصحيحة فقط ─────────
    const companyId: string =
      (request.body?.companyId   as string) ||
      (request.params?.companyId as string) ||
      (request.query?.companyId  as string) ||
      (request.headers?.['x-company-id'] as string) ||
      '';

    // ── لم يُحدَّد companyId → مرفوض لغير الـ Super Admin ──
    if (!companyId) {
      throw new ForbiddenException(
        'يجب تحديد معرف الشركة (companyId) للوصول لهذا المورد.',
      );
    }

    // ── هل المستخدم مرتبط بهذه الشركة؟ ───────────────────
    const companyIds: string[] = user.companyIds || [];
    if (!companyIds.includes(companyId)) {
      throw new ForbiddenException('غير مصرح لك بالوصول لهذه الشركة.');
    }

    // ── هل الشركة موجودة وتنتمي لـ tenant المستخدم؟ ────────
    // RLS يفلتر تلقائياً — إذا لم نجدها فالشركة إما غير موجودة أو في tenant آخر
    if (TenantContext.hasContext()) {
      const company = await this.prisma.company.findFirst({
        where: { id: companyId },
        select: { id: true, tenantId: true },
      });
      if (!company) {
        throw new ForbiddenException('الشركة غير موجودة أو غير مسموح بالوصول لها.');
      }
      if (company.tenantId !== TenantContext.getTenantId()) {
        throw new ForbiddenException('الشركة لا تنتمي لـ tenant المستخدم.');
      }
    }

    return true;
  }
}

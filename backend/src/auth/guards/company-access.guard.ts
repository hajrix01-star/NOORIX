/**
 * CompanyAccessGuard — يتحقق أن المستخدم يملك صلاحية الوصول للشركة المطلوبة.
 *
 * ترتيب استخراج companyId (من الأعلى أولويةً) — **مطابق** `getCompanyIdFromHttpRequest`:
 *   POST/PUT/PATCH:  body.companyId → params.companyId → query → x-company-id
 *   GET/DELETE/…:   params.companyId → query → x-company-id
 *   (لا يُستخدم params.id كشركة — يتعارض مع PATCH/GET لموارد مثل /orders-v4/documents/:id)
 *
 * التحققات:
 *   1. المستخدم مرتبط بالشركة — يُقرأ من DB (مُخزَّن مؤقتاً 60 ثانية لكل مستخدم)
 *      بدلاً من JWT فقط، للتغلب على مشكلة قِدَم companyIds في الـ token.
 *   2. الشركة موجودة وتنتمي لـ tenant المستخدم (RLS).
 *
 * استثناءات: Endpoints مُعلَّمة بـ @SkipCompanyCheck() تمر دون فحص.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getCompanyIdFromHttpRequest } from '../../common/utils/company-request';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { TenantContext } from '../../common/tenant-context';
import { isSuperAdmin }              from '../constants/permissions';
import { SKIP_COMPANY_CHECK_KEY }    from '../decorators/skip-company-check.decorator';

/** مدة صلاحية Cache عضوية الشركة لكل مستخدم (بالمللي ثانية) */
const COMPANY_MEMBERSHIP_TTL_MS = 60_000;

interface CacheEntry { companyIds: string[]; expiresAt: number }

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  /** Cache خفيف: userId → { companyIds, expiresAt } */
  private readonly membershipCache = new Map<string, CacheEntry>();

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

    // ── استخراج companyId (مصدر واحد مع @CompanyId()) ───
    const companyId = getCompanyIdFromHttpRequest(request);

    // ── لم يُحدَّد companyId → مرفوض لغير الـ Super Admin ──
    if (!companyId) {
      throw new ForbiddenException(
        'يجب تحديد معرف الشركة (companyId) للوصول لهذا المورد.',
      );
    }

    // ── هل المستخدم مرتبط بهذه الشركة؟ (DB + Cache) ──────
    const allowedIds = await this.resolveCompanyIds(user.sub ?? user.userId, user.companyIds);
    if (!allowedIds.includes(companyId)) {
      throw new ForbiddenException('غير مصرح لك بالوصول لهذه الشركة.');
    }

    // ── هل الشركة موجودة وتنتمي لـ tenant المستخدم؟ ────────
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

  /**
   * يجلب قائمة شركات المستخدم من DB مع Cache مدته 60 ثانية.
   * هذا يحل مشكلة قِدَم companyIds في JWT دون إضافة ضغط على DB.
   */
  private async resolveCompanyIds(userId: string, _jwtCompanyIds: string[] = []): Promise<string[]> {
    if (!userId) {
      throw new ForbiddenException('تعذر التحقق من صلاحيات الشركة.');
    }

    const now = Date.now();
    const cached = this.membershipCache.get(userId);
    if (cached && cached.expiresAt > now) return cached.companyIds;

    try {
      const rows = await this.prisma.userCompany.findMany({
        where: { userId },
        select: { companyId: true },
      });
      const ids = rows.map((r) => r.companyId);
      this.membershipCache.set(userId, { companyIds: ids, expiresAt: now + COMPANY_MEMBERSHIP_TTL_MS });
      return ids;
    } catch {
      throw new ForbiddenException('تعذر التحقق من صلاحيات الشركة.');
    }
  }
}

/**
 * DatabaseBootstrapService — تشغيل الـ Seed عند بدء التطبيق.
 * يضمن وجود المستخدم الافتراضي admin@noorix.sa في كل بيئة (تطوير/إنتاج).
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_ROLE_SEEDS } from '../auth/constants/permissions';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@noorix.sa';
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'Hajrim2h';
const DEFAULT_TENANT_ID = 'default-tenant-noorix-2024';

// الصلاحيات تُجلب من SYSTEM_ROLE_SEEDS — مصدر الحقيقة الوحيد
const ALL_PERMISSIONS = SYSTEM_ROLE_SEEDS['owner']?.permissions || [];

@Injectable()
export class DatabaseBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.APP_SKIP_SEED === 'true') {
      this.logger.log('تخطي الـ Seed (APP_SKIP_SEED=true)');
      return;
    }
    // تشغيل غير متزامن — لا يعطل بدء التطبيق
    this.ensureSeed().catch((err) => {
      this.logger.error('فشل تشغيل الـ Seed:', err);
    });
  }

  async ensureSeed() {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    let tenant = await this.prisma.tenant.findUnique({ where: { id: DEFAULT_TENANT_ID } });
    if (!tenant) {
      tenant = await this.prisma.tenant.findUnique({ where: { slug: 'abumasoud-group' } });
    }
    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          id: DEFAULT_TENANT_ID,
          name: 'مجموعة نويركس',
          slug: 'noorix-default',
          plan: 'enterprise',
          isActive: true,
          maxCompanies: 10,
        },
      });
      this.logger.log('تم إنشاء Tenant افتراضي');
    }

    const roleNames = ['owner', 'super_admin', 'accountant', 'cashier'];
    const roleMap: Record<string, string> = {};

    for (const name of roleNames) {
      let role = await this.prisma.role.findUnique({ where: { name } });
      const seed = SYSTEM_ROLE_SEEDS[name];
      if (!role) {
        role = await this.prisma.role.create({
          data: {
            name,
            nameAr: seed?.nameAr || name,
            isSystem: true,
            permissions: seed?.permissions || [],
          },
        });
        this.logger.log(`تم إنشاء دور: ${name}`);
      } else if (name === 'owner' || name === 'super_admin') {
        const current = (role.permissions || []) as string[];
        const merged = [...new Set([...current, ...ALL_PERMISSIONS])];
        if (merged.length > current.length) {
          await this.prisma.role.update({
            where: { id: role.id },
            data: { permissions: merged },
          });
          this.logger.log(`تم تحديث صلاحيات دور: ${name}`);
        }
      }
      roleMap[name] = role.id;
    }

    for (const name of ['accountant', 'cashier'] as const) {
      const r = await this.prisma.role.findUnique({ where: { name } });
      if (!r) continue;
      const seed = SYSTEM_ROLE_SEEDS[name];
      if (!seed) continue;
      const cur = (r.permissions || []) as string[];
      const merged = [...new Set([...cur, ...seed.permissions])];
      if (merged.length > cur.length) {
        await this.prisma.role.update({
          where: { id: r.id },
          data: { permissions: merged },
        });
        this.logger.log(`تم دمج صلاحيات الدور الافتراضي: ${name}`);
      }
    }

    let company = await this.prisma.company.findFirst({ where: { tenantId: tenant.id } });
    if (!company) {
      company = await this.prisma.company.create({
        data: {
          tenantId: tenant.id,
          nameAr: 'شركة نويركس الافتراضية',
          nameEn: 'Noorix Default Company',
          vatEnabledForSales: false,
        },
      });
      this.logger.log('تم إنشاء شركة افتراضية');
    }

    let user = await this.prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: ADMIN_EMAIL,
          passwordHash,
          nameAr: 'مدير النظام',
          nameEn: 'Admin',
          roleId: roleMap.owner,
          isActive: true,
        },
      });
      this.logger.log(`تم إنشاء مستخدم: ${ADMIN_EMAIL}`);
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      this.logger.log(`تم تحديث كلمة مرور: ${ADMIN_EMAIL}`);
    }

    const existingLink = await this.prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
    });
    if (!existingLink) {
      await this.prisma.userCompany.create({
        data: { userId: user.id, companyId: company.id },
      });
      this.logger.log('تم ربط المستخدم بالشركة');
    }

    this.logger.log(`Seed جاهز — الدخول: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  }
}

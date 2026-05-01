/**
 * DatabaseBootstrapService — تشغيل الـ Seed عند بدء التطبيق.
 * يضمن وجود المستخدم الافتراضي (admin@النطاق الرسمي) في كل بيئة (تطوير/إنتاج).
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DEFAULT_ADMIN_EMAIL } from '../common/official-email';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionCacheService } from '../auth/permission-cache.service';
import { SYSTEM_ROLE_SEEDS } from '../auth/constants/permissions';

const ADMIN_EMAIL = DEFAULT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'Hajrim2h';
const DEFAULT_TENANT_ID = 'default-tenant-noorix-2024';

// الصلاحيات تُجلب من SYSTEM_ROLE_SEEDS — مصدر الحقيقة الوحيد
const ALL_PERMISSIONS = SYSTEM_ROLE_SEEDS['owner']?.permissions || [];

@Injectable()
export class DatabaseBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permCache: PermissionCacheService,
  ) {}

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
            lastSeedPermissions: seed?.permissions || [],
          },
        });
        this.logger.log(`تم إنشاء دور: ${name}`);
      } else if (name === 'owner' || name === 'super_admin') {
        // owner/super_admin يحصلان دائماً على كل الصلاحيات الجديدة في الكود
        const current     = (role.permissions         || []) as string[];
        const lastSeedAdm = (role.lastSeedPermissions || []) as string[];
        const merged = [...new Set([...current, ...ALL_PERMISSIONS])];
        const permChanged = merged.length > current.length;
        const seedChanged = lastSeedAdm.length !== ALL_PERMISSIONS.length ||
          !ALL_PERMISSIONS.every((p) => lastSeedAdm.includes(p));
        if (permChanged || seedChanged) {
          await this.prisma.role.update({
            where: { id: role.id },
            data: {
              ...(permChanged ? { permissions: merged } : {}),
              lastSeedPermissions: ALL_PERMISSIONS,
            },
          });
          if (permChanged) this.logger.log(`تم تحديث صلاحيات دور: ${name}`);
        }
      }
      roleMap[name] = role.id;
    }

    // accountant / cashier — نُضيف فقط الصلاحيات الجديدة فعلاً في الكود
    // (موجودة في الـ seed الحالي لكن لم تكن في آخر seed طُبّق)
    // هذا يحترم ما حذفه المدير يدوياً ولا يُعيده
    for (const name of ['accountant', 'cashier'] as const) {
      const r = await this.prisma.role.findUnique({ where: { name } });
      if (!r) continue;
      const seed = SYSTEM_ROLE_SEEDS[name];
      if (!seed) continue;

      const cur         = (r.permissions         || []) as string[];
      const lastSeed    = (r.lastSeedPermissions  || []) as string[];
      const currentSeed = seed.permissions;

      if (lastSeed.length === 0) {
        // أول تشغيل بعد إضافة هذا الحقل — نُهيّئه بالـ seed الحالي فقط
        // بدون إضافة أي صلاحية حتى لا نُعيد ما حذفه المدير سابقاً
        await this.prisma.role.update({
          where: { id: r.id },
          data: { lastSeedPermissions: currentSeed },
        });
        this.logger.log(`تم تهيئة lastSeedPermissions لدور "${name}"`);
        continue;
      }

      // الصلاحيات التي أُضيفت للكود بعد آخر تطبيق للـ seed (جديدة حقاً)
      const trulyNew = currentSeed.filter((p) => !lastSeed.includes(p));
      // منها ما ليس موجوداً بعد في صلاحيات الدور الحالية
      const toAdd    = trulyNew.filter((p) => !cur.includes(p));

      const seedChanged = lastSeed.length !== currentSeed.length ||
        !currentSeed.every((p) => lastSeed.includes(p));

      if (toAdd.length > 0 || seedChanged) {
        await this.prisma.role.update({
          where: { id: r.id },
          data: {
            ...(toAdd.length > 0 ? { permissions: [...new Set([...cur, ...toAdd])] } : {}),
            lastSeedPermissions: currentSeed,
          },
        });
        if (toAdd.length > 0) {
          this.logger.log(`تم إضافة ${toAdd.length} صلاحية جديدة لدور "${name}": ${toAdd.join(', ')}`);
          this.permCache.invalidate(name);
        } else {
          this.logger.log(`تم تحديث lastSeedPermissions لدور "${name}" (بدون تغيير في الصلاحيات)`);
        }
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

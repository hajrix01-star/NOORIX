import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import slugify from 'slugify';
import { OFFICIAL_EMAIL_DOMAIN } from '../common/official-email';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext }  from '../common/tenant-context';

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'production' ? 12 : 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        nameAr: true,
        nameEn: true,
        preferredLang: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, name: true, nameAr: true } },
        userCompanies: { select: { companyId: true, company: { select: { id: true, nameAr: true } } } },
      },
    });
  }

  /** إزالة أحرف غير مرئية/اتجاه قد تُفرغ الجزء المحلي بعد التصفية. */
  private stripInvisibleAndBidi(s: string): string {
    return (s || '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u061C\u2066-\u2069]/g, '')
      .trim();
  }

  /**
   * جزء محلي من البريد من الاسم.
   * ملاحظة: [A-Za-z] في JS هي ASCII فقط — حرف «R» السيريلي (U+0420) يُزال فيُفرغ الجزء المحلي
   * إن لم نُحوّل عبر slugify. slugify يُحوّل العربية/السيريلية وغيرها إلى slug لاتيني آمن.
   */
  private buildEmailLocalPart(nameAr: string, nameEn?: string): string {
    const ar = this.stripInvisibleAndBidi(nameAr || '');
    const enRaw = this.stripInvisibleAndBidi(nameEn || '');
    const en = enRaw.toLowerCase();
    const fromEn = en.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    // حرف واحد (مثل "T" أو "G") يجب أن يصبح البريد t@domain / g@domain ليتوافق مع تسجيل الدخول بالاسم القصير
    if (fromEn.length >= 1) return fromEn.slice(0, 48);
    const fromArLatin = ar
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .toLowerCase()
      .replace(/^-+|-+$/g, '');
    if (fromArLatin.length >= 1) return fromArLatin.slice(0, 48);

    const combined = `${enRaw} ${ar}`.trim();
    const fromSlug = slugify(combined, { lower: true, strict: true, trim: true });
    if (fromSlug.length >= 1) return fromSlug.slice(0, 48);

    return `user-${randomBytes(4).toString('hex')}`;
  }

  /** يضمن عدم تكرار البريد داخل المستأجر (محلي + @النطاق الرسمي). */
  private async allocateOfficialEmail(nameAr: string, nameEn?: string): Promise<string> {
    const base = this.buildEmailLocalPart(nameAr, nameEn);
    const domain = OFFICIAL_EMAIL_DOMAIN;
    for (let i = 0; i < 80; i++) {
      const local = i === 0 ? base : `${base}-${i}`;
      const email = `${local}@${domain}`;
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (!existing) return email;
    }
    return `${base}-${randomBytes(4).toString('hex')}@${domain}`;
  }

  async create(data: {
    email?: string;
    loginName?: string;
    password: string;
    nameAr?: string;
    nameEn?: string;
    preferredLang?: string;
    roleName: string;
    companyIds: string[];
  }) {
    const nameArTrim = data.nameAr?.trim() || '';
    let email = (data.email || '').toLowerCase().trim();
    if (!email) {
      // أولوية: loginName مباشر (يكتبه المستخدم) → ثم استنتاج من الاسم
      if (data.loginName?.trim()) {
        const raw = data.loginName.trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9._-]{0,47}$/.test(raw)) {
          throw new BadRequestException('اسم الدخول يجب أن يبدأ بحرف أو رقم ويحتوي على أحرف لاتينية وأرقام ونقاط وشرطات فقط');
        }
        const candidate = `${raw}@${OFFICIAL_EMAIL_DOMAIN}`;
        const existing = await this.prisma.user.findUnique({ where: { email: candidate } });
        if (existing) throw new ConflictException('اسم الدخول مستخدَم مسبقاً، اختر اسماً آخر');
        email = candidate;
      } else if (nameArTrim) {
        email = await this.allocateOfficialEmail(nameArTrim, data.nameEn?.trim());
      } else {
        throw new BadRequestException('اسم الدخول أو الاسم مطلوب');
      }
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('البريد الإلكتروني أو اسم المستخدم مسجّل مسبقاً');

    const role = await this.prisma.role.findFirst({ where: { name: data.roleName } });
    if (!role) throw new ConflictException('الدور غير موجود');

    const tenantId     = TenantContext.getTenantId();
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        nameAr: nameArTrim || null,
        nameEn: data.nameEn?.trim() || null,
        preferredLang: (data.preferredLang === 'en' ? 'en' : 'ar'),
        roleId: role.id,
      },
    });

    for (const companyId of data.companyIds || []) {
      await this.prisma.userCompany.upsert({
        where: { userId_companyId: { userId: user.id, companyId } },
        update: {},
        create: { userId: user.id, companyId },
      });
    }

    return this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true, email: true, nameAr: true, nameEn: true, preferredLang: true, isActive: true,
        role: { select: { id: true, name: true, nameAr: true } },
        userCompanies: { select: { companyId: true, company: { select: { id: true, nameAr: true } } } },
      },
    });
  }

  async update(
    id: string,
    data: {
      nameAr?: string;
      nameEn?: string;
      preferredLang?: string;
      roleName?: string;
      password?: string;
      companyIds?: string[];
      loginName?: string;
    },
    currentUserId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const updateData: Record<string, unknown> = {};

    if (data.loginName !== undefined && data.loginName !== null) {
      const raw = data.loginName.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{0,47}$/.test(raw)) {
        throw new BadRequestException('اسم الدخول يجب أن يبدأ بحرف أو رقم ويحتوي على أحرف لاتينية وأرقام ونقاط وشرطات فقط (48 حرفًا كحد أقصى)');
      }
      const newEmail = `${raw}@${OFFICIAL_EMAIL_DOMAIN}`;
      const existing = await this.prisma.user.findUnique({ where: { email: newEmail } });
      if (existing && existing.id !== id) {
        throw new ConflictException('اسم الدخول مستخدَم مسبقًا، اختر اسمًا آخر');
      }
      updateData.email = newEmail;
    }
    if (data.nameAr !== undefined) updateData.nameAr = data.nameAr?.trim() || null;
    if (data.nameEn !== undefined) updateData.nameEn = data.nameEn?.trim() || null;
    if (data.preferredLang !== undefined) updateData.preferredLang = (data.preferredLang === 'en' ? 'en' : 'ar');

    if (data.password?.trim()) {
      updateData.passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    }

    if (data.roleName) {
      if (id === currentUserId) {
        throw new BadRequestException('لا يمكنك تغيير صلاحيتك بنفسك — تواصل مع مشرف آخر');
      }
      const role = await this.prisma.role.findFirst({ where: { name: data.roleName } });
      if (!role) throw new BadRequestException('الدور غير موجود');
      updateData.roleId = role.id;
    }

    await this.prisma.user.update({ where: { id }, data: updateData });

    if (Array.isArray(data.companyIds)) {
      await this.prisma.userCompany.deleteMany({ where: { userId: id } });
      for (const companyId of data.companyIds) {
        await this.prisma.userCompany.create({ data: { userId: id, companyId } });
      }
    }

    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, nameAr: true, nameEn: true, preferredLang: true, isActive: true,
        role: { select: { id: true, name: true, nameAr: true } },
        userCompanies: { select: { companyId: true, company: { select: { id: true, nameAr: true } } } },
      },
    });
  }

  async archive(id: string, currentUserId: string) {
    if (id === currentUserId) throw new BadRequestException('لا يمكنك أرشفة حسابك الحالي');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, email: true, isActive: true },
    });
  }

  async restore(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, email: true, isActive: true },
    });
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) throw new BadRequestException('لا يمكنك حذف حسابك الحالي');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    // حذف ناعم: تعطيل الحساب فقط (لا حذف فعلي لضمان سجل التدقيق)
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false, email: `deleted_${Date.now()}_${user.email}` },
      select: { id: true, email: true },
    });
  }
}

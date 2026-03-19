/**
 * AuthService — مصادقة المستخدمين
 * ✅ JWT payload يحتوي على tenantId — لازم لـ TenantMiddleware + RLS
 */
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService }   from '@nestjs/jwt';
import * as bcrypt      from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { nowSaudi }     from '../common/utils/date-utils';

export interface JwtPayload {
  sub:        string;
  email:      string;
  role:       string;
  tenantId:   string;    // ✅ إضافة tenantId للـ JWT
  companyIds: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma:      PrismaService,
    private readonly jwtService:  JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        role:         { select: { id: true, name: true, nameAr: true, permissions: true } },
        userCompanies: { select: { companyId: true } },
      },
    });
    if (!user || !user.isActive) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
  }

  async getRoleWithPermissions(roleName: string) {
    return this.prisma.role.findFirst({
      where:  { name: roleName },
      select: { id: true, name: true, nameAr: true, permissions: true },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('UNAUTHORIZED');
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('كلمة المرور الحالية غير صحيحة');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, updatedAt: nowSaudi() },
    });
    return { success: true };
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('UNAUTHORIZED');

    await this.prisma.user.update({
      where: { id: user.id },
      data:  { lastActivityAt: nowSaudi() },
    });

    const roleName    = (user.role?.name || '').toLowerCase();
    const isSuperAdmin = roleName === 'super_admin' || roleName === 'owner';

    let companyIds = user.userCompanies.map((uc) => uc.companyId);
    if (isSuperAdmin) {
      // Super Admin يرى جميع شركات الـ Tenant نفسه فقط
      const all = await this.prisma.company.findMany({
        where:  { tenantId: user.tenantId, isArchived: false },
        select: { id: true },
      });
      companyIds = all.map((c) => c.id);
    }

    const payload: JwtPayload = {
      sub:        user.id,
      email:      user.email,
      role:       user.role.name,
      tenantId:   user.tenantId,   // ✅ tenantId في كل token
      companyIds,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id:          user.id,
        email:       user.email,
        nameAr:      user.nameAr,
        nameEn:      user.nameEn,
        role:        user.role.name,
        roleNameAr:  user.role.nameAr,
        permissions: user.role.permissions,
        tenantId:    user.tenantId,
        companyIds:  payload.companyIds,
      },
    };
  }
}

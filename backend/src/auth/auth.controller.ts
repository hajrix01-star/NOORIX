import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  @MinLength(1)
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}

class RefreshTokenDto {
  @IsString()
  @MinLength(1)
  refresh_token: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refreshAccessToken(body.refresh_token);
  }

  @Post('change-password')
  @UseGuards(AuthGuard('jwt'))
  async changePassword(
    @Req() req: { user: { userId: string; email: string } },
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.userId, body.currentPassword, body.newPassword);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Req() req: { user: { userId: string; email: string; role: string; tenantId?: string; companyIds: string[] } }) {
    const jwtUser = req.user;
    const dbUser = await this.authService.getFullUser(jwtUser.userId);
    if (!dbUser) {
      return {
        id: jwtUser.userId,
        email: jwtUser.email,
        role: jwtUser.role,
        permissions: [],
        companyIds: jwtUser.companyIds || [],
      };
    }
    return {
      id:          dbUser.id,
      email:       dbUser.email,
      nameAr:      dbUser.nameAr,
      nameEn:      dbUser.nameEn,
      role:        dbUser.role.name,
      roleNameAr:  dbUser.role.nameAr,
      permissions: Array.isArray(dbUser.role.permissions) ? dbUser.role.permissions : [],
      tenantId:    dbUser.tenantId,
      companyIds:  dbUser.userCompanies.map((uc) => uc.companyId),
    };
  }
}

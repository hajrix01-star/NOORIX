import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString()
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
  async me(@Req() req: { user: { userId: string; email: string; role: string; companyIds: string[] } }) {
    const user = req.user;
    const roleRecord = await this.authService.getRoleWithPermissions(user.role);
    return {
      id: user.userId,
      email: user.email,
      role: user.role,
      roleNameAr: roleRecord?.nameAr ?? null,
      permissions: roleRecord?.permissions ?? [],
      companyIds: user.companyIds || [],
    };
  }
}

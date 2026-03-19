import { Controller, Post, Body, Headers, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { ChatService } from './chat.service';

/** Rate limit: 30 طلب/دقيقة لكل مستخدم */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): void {
  const now = Date.now();
  let entry = requestCounts.get(userId);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    requestCounts.set(userId, entry);
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    throw new HttpException(
      { success: false, error: 'تجاوزت حد الطلبات. انتظر دقيقة وحاول مجدداً.', code: 429 },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Controller('chat')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('query')
  @RequirePermission('SMART_CHAT_READ')
  async query(
    @Body() body: { query: string },
    @Headers('x-company-id') headerCompanyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    checkRateLimit(user.sub || 'anon');

    const companyId = headerCompanyId || (user.companyIds && user.companyIds[0]);
    if (!companyId) {
      return { success: false, error: 'يجب تحديد الشركة', code: 400 };
    }
    const result = await this.chatService.processQuery(
      companyId,
      body.query || '',
      user.role || '',
    );
    return { success: true, data: result };
  }
}

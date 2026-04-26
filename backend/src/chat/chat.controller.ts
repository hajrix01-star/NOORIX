import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { GeminiService } from './gemini.service';

/** Rate limit: 30 طلب/دقيقة لكل مستخدم */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
/** تنظيف دوري لتفادي نمو الـ Map إلى ما لا نهاية (كل عملية cluster لها نسختها) */
const RATE_MAP_MAX_ENTRIES = 10_000;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function pruneExpiredRateEntries(now: number): void {
  if (requestCounts.size <= RATE_MAP_MAX_ENTRIES) return;
  for (const [uid, e] of requestCounts) {
    if (now > e.resetAt) requestCounts.delete(uid);
  }
  if (requestCounts.size > RATE_MAP_MAX_ENTRIES) {
    const drop = requestCounts.size - Math.floor(RATE_MAP_MAX_ENTRIES * 0.8);
    let i = 0;
    for (const uid of requestCounts.keys()) {
      requestCounts.delete(uid);
      if (++i >= drop) break;
    }
  }
}

function checkRateLimit(userId: string): void {
  const now = Date.now();
  pruneExpiredRateEntries(now);
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
  constructor(
    private readonly chatService: ChatService,
    private readonly geminiService: GeminiService,
  ) {}

  @Post('query')
  @RequirePermission('SMART_CHAT_READ')
  async query(
    @Body() body: { query: string },
    @CompanyId() companyIdFromRequest: string,
    @CurrentUser() user: JwtUser,
  ) {
    checkRateLimit(user.sub || user.userId || 'anon');

    const companyId =
      companyIdFromRequest?.trim() || (user.companyIds && user.companyIds[0]);
    if (!companyId) {
      return { success: false, error: 'يجب تحديد الشركة', code: 400 };
    }
    const result = await this.chatService.processQuery(
      companyId,
      body.query || '',
      user.role || '',
      user.permissions,
    );
    return { success: true, data: result };
  }

}

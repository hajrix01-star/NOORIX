import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Liveness: العملية تعمل (بدون DB) — للـ LB ومراقب يميّز «العملية ميتة» عن «DB معطوس».
   * GET /api/v1/health/live → دائماً 200 عند إقلاع الـ process.
   */
  @Get('health/live')
  @SkipThrottle()
  liveness() {
    return {
      status: 'live',
      service: 'noorix-backend',
      uptimeSec: Math.floor(process.uptime()),
    };
  }

  /**
   * Readiness: يتضمّن اختبار DB. 503 عندما لا يصبح التطبيق جاهزاً لخدمة الطلبات
   * (متوافق مع مراقبة خارجية و`curl -f` عند الاضطراب).
   */
  @Get('health')
  @SkipThrottle()
  async getHealth(@Res() res: Response) {
    const data = await this.appService.getHealth();
    return res.status(data.status === 'ok' ? 200 : 503).json(data);
  }

  @Get('gemini-test')
  @UseGuards(AuthGuard('jwt'))
  async testGemini() {
    return this.appService.testGemini();
  }
}

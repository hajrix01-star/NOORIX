import * as dotenv from 'dotenv';
dotenv.config();

import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

const processLogger = new Logger('Process');

/** رفض الوعود المرفوضة دون معالج — تسجيل فقط (لا exit) لتقليل تعطل العملية بسبب أخطاء برمجية جانبية */
process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
  processLogger.error(`unhandledRejection — ${msg}`);
});

/**
 * أخطاء متزامنة غير معالجة: الحالة قد تكون غير سليمة؛ نُسجّل ثم نخرج ليعيد PM2 التشغيل من جديد.
 * (ابتلاع الخطأ هنا يسمح للعملية بالاستمرار لكنه غير موصى به في Node.)
 */
process.on('uncaughtException', (err: Error) => {
  processLogger.error(`uncaughtException — ${err.message}`, err.stack);
  setTimeout(() => process.exit(1), 750).unref();
});

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // ── JWT_SECRET إلزامي في الإنتاج ──
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    logger.error('❌ JWT_SECRET غير محدد — لا يمكن التشغيل في الإنتاج بدونه');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL?.trim()) {
    logger.error('❌ DATABASE_URL غير مُعرّف في الإنتاج');
    process.exit(1);
  }

  // إنتاج نووريكس/حاجريكس: افتراضي hajrix.com — بدونها كان PM2 يلفّ (exit) ولن تُفتح 3000 أبداً
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN?.trim()) {
    process.env.CORS_ORIGIN = 'https://hajrix.com';
    logger.warn(
      'CORS_ORIGIN غير مضبوط في .env — يُستخدم الافتراضي https://hajrix.com (راجع backend/.env للتعديل أو نطاقات إضافية)',
    );
  }

  const port = parseInt(process.env.PORT ?? '3000', 10);

  logger.log(`بدء التطبيق — PORT=${port} DATABASE_URL=${process.env.DATABASE_URL ? '✓' : '✗'} JWT_SECRET=${process.env.JWT_SECRET ? '✓' : '⚠ dev-fallback'}`);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // خلف Nginx: حتى يقرأ Throttle (وreq.ip) عنوان الزائر من X-Forwarded-For بدل 127.0.0.1 لكل الطلبات
  if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // ── Body parser بحد 50MB (رفع كشوف Excel/CSV كبيرة) ──
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // ── Helmet: حماية HTTP headers (XSS, clickjacking, MIME sniffing) ──
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  /**
   * CSP بصيغة Report-Only فقط — لا يُعطّل الواجهة؛ يُرسِل انتهاكات إلى وحدة التحكم للمراجعة
   * قبل تفعيل سياسة فعلية. يُطبَّق على استجابات الـ API (مستندات/أخطاء HTML إن وُجدت).
   */
  const cspReportOnly =
    "default-src 'self'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'; object-src 'none'; " +
    "script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; " +
    "connect-src 'self'; worker-src 'self'; manifest-src 'self' data:";
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy-Report-Only', cspReportOnly);
    next();
  });

  // ── Compression: ضغط gzip للاستجابات ──
  app.use(compression());

  app.useGlobalFilters(new HttpExceptionFilter());

  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : true;
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-company-id'],
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  const server = app.getHttpServer();

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        `المنفذ ${port} مشغول — غالباً عمليتان PM2 تشغّلان نفس التطبيق (مثل noorix-api و noorix-backend) بنفس PORT. احذف/عطّل إحداهما أو غيّر PORT في .env.`,
      );
      process.exit(1);
      return;
    }
    logger.error(`خطأ خادم HTTP: ${err.message}`, err.stack);
    process.exit(1);
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`Noorix Backend يعمل على المنفذ ${port} — Helmet ✓ — Compression ✓ — ThrottleGuard ✓`);
}

bootstrap().catch((err) => {
  console.error('❌ فشل بدء التطبيق:', err);
  process.exit(1);
});

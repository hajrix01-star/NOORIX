import * as dotenv from 'dotenv';
dotenv.config();

// Supabase: حل نهائي لـ MaxClientsInSessionMode — تقليل الاتصالات + Transaction mode
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.includes('supabase')) {
  let url = dbUrl;
  const isDirect = url.includes('db.') && url.includes('supabase.co') && !url.includes('pooler');
  const isPoolerSession = url.includes('pooler.supabase.com') && /:5432(\/|\?|$)/.test(url);

  // 1) Pooler Session → Transaction: استبدال 5432 بـ 6543 (يُجنّب MaxClientsInSessionMode)
  if (isPoolerSession) {
    url = url.replace(/\.pooler\.supabase\.com:5432/g, '.pooler.supabase.com:6543');
  }

  // 2) connection_limit: Direct يستخدم 1 فقط (حد أدنى). Pooler يستخدم 2.
  const defaultLimit = isDirect ? '1' : '2';
  const connLimit = process.env.DATABASE_CONNECTION_LIMIT || defaultLimit;
  if (!url.includes('connection_limit=')) {
    url += (url.includes('?') ? '&' : '?') + `connection_limit=${connLimit}`;
  }

  if (!url.includes('sslmode=')) url += (url.includes('?') ? '&' : '?') + 'sslmode=require';
  if (url.includes('pooler') && !url.includes('pgbouncer=')) url += (url.includes('?') ? '&' : '?') + 'pgbouncer=true';
  process.env.DATABASE_URL = url;

  if (isDirect && process.env.NODE_ENV === 'production') {
    console.warn('⚠ Supabase Direct (db.xxx.supabase.co) محدود جداً. استخدم Pooler Transaction (منفذ 6543) من Project Settings → Database.');
  }
}

import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
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

  const port = parseInt(process.env.PORT ?? '3000', 10);

  logger.log(`بدء التطبيق — PORT=${port} DATABASE_URL=${process.env.DATABASE_URL ? '✓' : '✗'} JWT_SECRET=${process.env.JWT_SECRET ? '✓' : '⚠ dev-fallback'}`);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // ── Body parser بحد 50MB (رفع كشوف Excel/CSV كبيرة) ──
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // ── Helmet: حماية HTTP headers (XSS, clickjacking, MIME sniffing) ──
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // ── Compression: ضغط gzip للاستجابات ──
  app.use(compression());

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true,
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

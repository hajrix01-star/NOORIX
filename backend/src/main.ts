import * as dotenv from 'dotenv';
dotenv.config();

// Supabase: SSL + تقليل الاتصالات لتجنب MaxClientsInSessionMode (Session mode محدود حسب pool_size)
// المشروع يستخدم PrismaService و TenantPrismaService → ضعف الاتصالات. connection_limit=5 لكل منهما = 10 إجمالاً.
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.includes('supabase')) {
  let url = dbUrl;
  if (!url.includes('sslmode=')) url += (url.includes('?') ? '&' : '?') + 'sslmode=require';
  if (!url.includes('connection_limit=')) url += (url.includes('?') ? '&' : '?') + 'connection_limit=5';
  process.env.DATABASE_URL = url;
}

import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // ── JWT_SECRET إلزامي في الإنتاج ──
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    logger.error('❌ JWT_SECRET غير محدد — لا يمكن التشغيل في الإنتاج بدونه');
    process.exit(1);
  }

  const port = parseInt(process.env.PORT ?? '3000', 10);

  logger.log(`بدء التطبيق — PORT=${port} DATABASE_URL=${process.env.DATABASE_URL ? '✓' : '✗'} JWT_SECRET=${process.env.JWT_SECRET ? '✓' : '⚠ dev-fallback'}`);

  const app = await NestFactory.create(AppModule);

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
        `المنفذ ${port} مشغول. نفّذ: Stop-Process -Name "node" -Force ثم أعد التشغيل`,
      );
      process.exit(1);
    }
    throw err;
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`Noorix Backend يعمل على المنفذ ${port} — Helmet ✓ — Compression ✓ — ThrottleGuard ✓`);
}

bootstrap().catch((err) => {
  console.error('❌ فشل بدء التطبيق:', err);
  process.exit(1);
});

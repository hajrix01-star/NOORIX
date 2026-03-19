import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = parseInt(process.env.PORT ?? '3000', 10);

  const app = await NestFactory.create(AppModule);

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

  // Graceful shutdown: تنظيف المنفذ عند الإيقاف
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
  logger.log(`Noorix Backend يعمل على المنفذ ${port}`);
}
bootstrap();

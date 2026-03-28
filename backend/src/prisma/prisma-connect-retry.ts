import { Logger } from '@nestjs/common';

const MAX_ATTEMPTS = parseInt(process.env.DATABASE_CONNECT_RETRIES ?? '12', 10);
const DELAY_MS = parseInt(process.env.DATABASE_CONNECT_RETRY_MS ?? '2500', 10);

/**
 * إعادة محاولة $connect عند إقلاع التطبيق (قاعدة غير جاهزة مؤقتاً، شبكة، إلخ).
 * بعد استنفاد المحاولات يُعاد رمي آخر خطأ — PM2 أو المنصة تعيد التشغيل.
 */
export async function connectPrismaWithRetry(
  connect: () => Promise<void>,
  logLabel: string,
): Promise<void> {
  const logger = new Logger(logLabel);
  let lastErr: unknown;
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      await connect();
      if (i > 1) {
        logger.log(`اتصال قاعدة البيانات نجح بعد المحاولة ${i}/${MAX_ATTEMPTS}`);
      }
      return;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`فشل اتصال DB (${i}/${MAX_ATTEMPTS}): ${msg}`);
      if (i < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }
  }
  logger.error('استُنفدت محاولات الاتصال بقاعدة البيانات');
  throw lastErr;
}

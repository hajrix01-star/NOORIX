/**
 * HttpExceptionFilter — يعيد رسالة الخطأ الفعلية للعميل عند 500.
 * يساعد في تشخيص أخطاء Prisma و Validation.
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'خطأ داخلي في الخادم';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errRes = exception.getResponse();
      message = typeof errRes === 'object' && errRes !== null && 'message' in errRes
        ? (errRes as { message: string | string[] }).message
        : String(errRes);
    } else if (exception instanceof Error) {
      message = exception.message;
      // تحويل أخطاء Prisma لرسائل مفهومة
      if (exception.name === 'PrismaClientKnownRequestError') {
        const prismaErr = exception as { code?: string; meta?: { target?: string[] } };
        if (prismaErr.code === 'P2003') {
          message = 'مرجع غير صالح (مورد أو حساب غير موجود)';
          status = HttpStatus.BAD_REQUEST;
        } else if (prismaErr.code === 'P2002') {
          message = 'القيمة مكررة بالفعل';
          status = HttpStatus.BAD_REQUEST;
        }
      }
      this.logger.error(`Unhandled: ${exception.message}`, exception.stack);
    }

    const body = {
      success: false,
      statusCode: status,
      message: Array.isArray(message) ? message.join(', ') : message,
    };

    res.status(status).json(body);
  }
}

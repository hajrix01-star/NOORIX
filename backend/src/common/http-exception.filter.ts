/**
 * HttpExceptionFilter — أخطاء تُعرض للعميل. في production لا تُرسل تفاصيل داخلية/Prisma الخام.
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

const isProd = process.env.NODE_ENV === 'production';

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
      // لا تُرسل تفاصيل 5xx يدوية للعميل في الإنتاج — قد تحوي مسارات ملفات أو رسائل مكتبات
      if (isProd && status >= 500) {
        message = 'خطأ داخلي في الخادم';
      }
    } else if (exception instanceof Error) {
      if (exception.name === 'PrismaClientKnownRequestError') {
        const prismaErr = exception as { code?: string; meta?: { target?: string[] } };
        if (prismaErr.code === 'P2003') {
          message = 'مرجع غير صالح (مورد أو حساب غير موجود)';
          status = HttpStatus.BAD_REQUEST;
        } else if (prismaErr.code === 'P2002') {
          message = 'القيمة مكررة بالفعل';
          status = HttpStatus.BAD_REQUEST;
        } else {
          message = isProd
            ? 'خطأ في قاعدة البيانات'
            : exception.message;
        }
      } else {
        message = isProd ? 'خطأ داخلي في الخادم' : exception.message;
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

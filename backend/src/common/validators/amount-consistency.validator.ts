/**
 * Custom validator: netAmount + taxAmount ≈ totalAmount (tolerance 0.01)
 * يُستخدم عندما يُرسل العميل netAmount و taxAmount صراحةً — للتحقق من عدم التلاعب.
 */
import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

const TOLERANCE = 0.01;

export function IsAmountConsistent(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name:         'isAmountConsistent',
      target:       object.constructor,
      propertyName,
      options:      validationOptions,
      constraints:  [],
      validator:    {
        validate(value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          const total = Number(obj.totalAmount ?? 0);
          const net   = Number(obj.netAmount ?? 0);
          const tax   = Number(obj.taxAmount ?? 0);
          if (total <= 0) return true; // يُترك لـ @Min(0.01) على totalAmount
          const sum = net + tax;
          return Math.abs(sum - total) <= TOLERANCE;
        },
        defaultMessage() {
          return `المجموع (الصافي + الضريبة) يجب أن يساوي الإجمالي بهامش خطأ ${TOLERANCE}`;
        },
      },
    });
  };
}

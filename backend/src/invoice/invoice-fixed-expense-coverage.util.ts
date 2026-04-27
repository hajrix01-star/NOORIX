import { BadRequestException } from '@nestjs/common';

export type FixedExpenseCoverageInput = {
  kind: string;
  expenseLineId?: string | null;
  expenseCoverageYear?: number | null;
  expenseCoverageQuarter?: number | null;
  expenseCoverageMonthStart?: number | null;
  expenseMonthsCovered?: number | null;
};

/**
 * تطبيع حقول تغطية المصروف الثابت (ربع/أشهر) — فقط عند kind=fixed_expense و expenseLineId.
 */
export function resolveFixedExpenseCoverageForCreate(dto: FixedExpenseCoverageInput): {
  expenseCoverageYear?: number;
  expenseCoverageQuarter?: number;
  expenseCoverageMonthStart?: number;
  expenseMonthsCovered?: number;
} {
  let expenseCoverageYear: number | undefined;
  let expenseCoverageQuarter: number | undefined;
  let expenseCoverageMonthStart: number | undefined;
  let expenseMonthsCovered: number | undefined;

  if (dto.kind === 'fixed_expense' && dto.expenseLineId) {
    const y = dto.expenseCoverageYear;
    if (y == null || y < 2000 || y > 2100) {
      throw new BadRequestException('سنة التغطية مطلوبة للمصروف الثابت (بين 2000 و 2100)');
    }
    expenseCoverageYear = y;

    if (dto.expenseCoverageQuarter != null) {
      const q = dto.expenseCoverageQuarter;
      if (q < 1 || q > 4) {
        throw new BadRequestException('الربع يجب أن يكون بين 1 و 4');
      }
      expenseCoverageQuarter = q;
      expenseCoverageMonthStart = (q - 1) * 3 + 1;
      expenseMonthsCovered = 3;
    } else {
      const ms = dto.expenseCoverageMonthStart;
      const mc = dto.expenseMonthsCovered;
      if (ms == null || mc == null) {
        throw new BadRequestException('حدد الربع أو نطاق الأشهر (شهر البداية وعدد الأشهر) للمصروف الثابت');
      }
      if (ms < 1 || ms > 12) {
        throw new BadRequestException('شهر بداية التغطية يجب أن يكون بين 1 و 12');
      }
      if (mc < 1 || mc > 12) {
        throw new BadRequestException('عدد الأشهر المغطاة يجب أن يكون بين 1 و 12');
      }
      if (ms + mc - 1 > 12) {
        throw new BadRequestException('نطاق الأشهر يجب ألا يتجاوز نهاية السنة الميلادية');
      }
      expenseCoverageQuarter = undefined;
      expenseCoverageMonthStart = ms;
      expenseMonthsCovered = mc;
    }
  }

  return {
    expenseCoverageYear,
    expenseCoverageQuarter,
    expenseCoverageMonthStart,
    expenseMonthsCovered,
  };
}

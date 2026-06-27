import { BadRequestException } from '@nestjs/common';
import type { PayrollRunItemDto } from './dto/create-payroll-run.dto';
import { computeHrPayrollLineNet } from './hr-payroll-line-net.util';

/** مجموع أجزاء الخزائن يجب أن يطابق صافي المسيرة (مجموع صافي السطور). */
export function assertPayrollRunVaultSplitsMatchTotal(
  splits: Array<{ amount: number | string }>,
  totalAmount: number,
): void {
  const EPS = 0.02;
  const sum = splits.reduce((s, x) => s + Number(x.amount), 0);
  if (!Number.isFinite(sum) || !Number.isFinite(totalAmount) || Math.abs(sum - totalAmount) > EPS) {
    throw new BadRequestException(
      `مجموع توزيع الخزائن (${Number(sum).toFixed(2)}) يجب أن يساوي إجمالي صافي المسيرة (${Number(totalAmount).toFixed(2)}).`,
    );
  }
}

/** صافي السطر = max(0, إجمالي + بدلات إضافية − خصومات − سلف) — يطابق الواجهة. */
export function assertPayrollItemsNetConsistent(items: PayrollRunItemDto[]): void {
  const EPS = 0.02;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const net = Number(it.netSalary);
    const expected = computeHrPayrollLineNet(it);
    if (!Number.isFinite(net) || !Number.isFinite(expected) || Math.abs(net - expected) > EPS) {
      throw new BadRequestException(
        `السطر ${i + 1}: صافي الراتب (${net}) لا يطابق الحساب (المتوقع ≈ ${expected.toFixed(2)}: إجمالي + بدلات إضافية − خصومات − سلف).`,
      );
    }
  }
}

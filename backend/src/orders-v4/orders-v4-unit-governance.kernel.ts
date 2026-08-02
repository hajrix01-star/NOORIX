import { BadRequestException } from '@nestjs/common';

export function assertOrdersV4UnitDeactivationAllowed(referenceCounts: readonly number[]): void {
  if (referenceCounts.some((count) => count > 0)) {
    throw new BadRequestException('لا يمكن تعطيل وحدة مستخدمة في صنف أو تحويل أو رسبي أو مستند أو مخزون تاريخي');
  }
}

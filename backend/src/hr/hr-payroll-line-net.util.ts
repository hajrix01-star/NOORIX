import {
  computeHrPayrollLineNet as computeSharedHrPayrollLineNet,
  type HrPayrollLineNetInput as SharedHrPayrollLineNetInput,
} from '@noorix/finance-core';

export type HrPayrollLineNetInput = SharedHrPayrollLineNetInput;

export function computeHrPayrollLineNet(input: HrPayrollLineNetInput): number {
  return computeSharedHrPayrollLineNet(input);
}

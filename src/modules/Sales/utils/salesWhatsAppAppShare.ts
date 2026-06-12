import { waAppShareMetricLine, waAppSharePercentLine } from '../../../utils/whatsappTextFormat';
import type { AppShareResult } from './salesAppShare';

export type AppendAppShareWaOptions = {
  /** للشهر — النسبة فقط دون مبالغ التطبيق/الإجمالي */
  percentOnly?: boolean;
};

export function appendAppShareWaLines(
  lines: string[],
  share: AppShareResult,
  label: string,
  options?: AppendAppShareWaOptions,
): void {
  if (share.totalAmount <= 0) return;
  if (options?.percentOnly) {
    lines.push(waAppSharePercentLine(label, share.appPercent));
    return;
  }
  lines.push(waAppShareMetricLine(label, share.appPercent, share.appAmount, share.totalAmount));
}

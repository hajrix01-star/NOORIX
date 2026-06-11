import { waAppShareMetricLine } from '../../../utils/whatsappTextFormat';
import type { AppShareResult } from './salesAppShare';

export function appendAppShareWaLines(
  lines: string[],
  share: AppShareResult,
  label: string,
): void {
  if (share.totalAmount <= 0) return;
  lines.push(waAppShareMetricLine(label, share.appPercent, share.appAmount, share.totalAmount));
}

/**
 * تنسيق عرض للتقارير فقط — نفس fmt السابق دون تغيير الحسابات.
 */
import { fmt } from '../../../../../utils/format';

export function formatMoneyForReport(n: number) {
  return fmt(n);
}

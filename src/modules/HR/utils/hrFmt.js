/**
 * تنسيق أرقام قسم الموارد البشرية — عرض صحيح بدون كسور عشرية.
 */
import { fmt } from '../../../utils/format';

export function hrFmt(n) {
  return fmt(n, 0);
}

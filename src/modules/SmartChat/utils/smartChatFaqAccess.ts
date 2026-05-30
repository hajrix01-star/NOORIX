import { PERMISSIONS } from '../../../constants/permissions';
import type { PermissionChecker } from '../types';

/** سؤال جاهز: صلاحية مخصّصة، أو CHAT_PRESET_FAQ القديمة مع فلتر القسم السابق */
export function canUseFaqQuestion(
  c: PermissionChecker,
  faqPermission: string,
  legacyDomain: (checker: PermissionChecker) => boolean,
): boolean {
  if (c(faqPermission)) return true;
  if (c(PERMISSIONS.CHAT_PRESET_FAQ) && legacyDomain(c)) return true;
  return false;
}

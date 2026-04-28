import { PERMISSIONS } from '../../../constants/permissions';
import type { ChatCommandGroupFiltered, PermanentQuestion, PermissionChecker } from '../types';
import { CMD_GROUPS } from './smartChatConstants';

export function filterVisibleFaqQuestions(
  showFaq: boolean,
  questions: PermanentQuestion[],
  can: PermissionChecker,
): PermanentQuestion[] {
  return showFaq ? questions.filter((q) => q.domain(can)) : [];
}

export function filterCommandGroups(can: PermissionChecker): ChatCommandGroupFiltered[] {
  return CMD_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => it.canUse(can)),
  })).filter((g) => g.items.length > 0);
}

export function canUseChatPresetFaq(can: PermissionChecker): boolean {
  return can(PERMISSIONS.CHAT_PRESET_FAQ) || can(PERMISSIONS.VIEW_CHAT);
}

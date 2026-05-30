import type { ChatCommandGroupFiltered, PermanentQuestion, PermissionChecker } from '../types';
import { CMD_GROUPS } from './smartChatConstants';

export function filterVisibleFaqQuestions(
  questions: PermanentQuestion[],
  can: PermissionChecker,
): PermanentQuestion[] {
  return questions.filter((q) => q.canUse(can));
}

export function filterCommandGroups(can: PermissionChecker): ChatCommandGroupFiltered[] {
  return CMD_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => it.canUse(can)),
  })).filter((g) => g.items.length > 0);
}

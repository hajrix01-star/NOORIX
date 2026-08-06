export type CategoryTreeNode = {
  id: string;
  parentId: string | null;
};

/**
 * Expands one or more category ids to the complete subtree represented by them.
 * The function is iterative so malformed/deep trees cannot overflow the stack.
 */
export function expandCategoryTreeIds(
  rootIds: Iterable<string>,
  categories: Iterable<CategoryTreeNode>,
): Set<string> {
  const result = new Set([...rootIds].map((id) => id.trim()).filter(Boolean));
  if (!result.size) return result;

  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const children = childrenByParent.get(category.parentId) ?? [];
    children.push(category.id);
    childrenByParent.set(category.parentId, children);
  }

  const pending = [...result];
  while (pending.length) {
    const parentId = pending.pop()!;
    for (const childId of childrenByParent.get(parentId) ?? []) {
      if (result.has(childId)) continue;
      result.add(childId);
      pending.push(childId);
    }
  }
  return result;
}

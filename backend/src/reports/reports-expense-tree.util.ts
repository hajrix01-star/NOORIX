import type { ExpenseTreeNode } from './reports-general-profit-loss-model.util';

export function findInExpenseTree(items: ExpenseTreeNode[], key: string): ExpenseTreeNode | null {
  for (const item of items) {
    if (item.key === key) return item;
    if (item.children) {
      const found = findInExpenseTree(item.children, key);
      if (found) return found;
    }
  }
  return null;
}

export function flattenExpenseTreeNodes(items: ExpenseTreeNode[]): ExpenseTreeNode[] {
  const out: ExpenseTreeNode[] = [];
  for (const item of items) {
    out.push(item);
    if (item.children?.length) {
      out.push(...flattenExpenseTreeNodes(item.children));
    }
  }
  return out;
}

export function resolveExpenseTreeNode(
  items: ExpenseTreeNode[],
  key: string,
): ExpenseTreeNode | null {
  return findInExpenseTree(items, key) ?? flattenExpenseTreeNodes(items).find((n) => n.key === key) ?? null;
}

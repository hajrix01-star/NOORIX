import type { ExpenseTreeNode, GeneralRowModel } from '../../../reports/reports-general-profit-loss-model.util';
import { flattenExpenseTreeNodes } from '../../../reports/reports-expense-tree.util';

/** Flattens P&L group `items` whether stored as a flat list or category tree. */
export function flattenPlGroupItems(items: GeneralRowModel[] | ExpenseTreeNode[] | undefined): GeneralRowModel[] {
  if (!items?.length) return [];
  return flattenExpenseTreeNodes(items as ExpenseTreeNode[]) as GeneralRowModel[];
}

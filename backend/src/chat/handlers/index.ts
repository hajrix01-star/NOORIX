/**
 * سجل معالجات المحادثة الذكية — تُنفَّذ بالترتيب حسب الأولوية
 */
import type { ChatHandler } from './types';
import { salesHandler } from './sales.handler';
import { purchasesHandler } from './purchases.handler';
import { expensesHandler } from './expenses.handler';
import { reportsHandler } from './reports.handler';
import { vaultsHandler } from './vaults.handler';
import { invoicesHandler } from './invoices.handler';
import { suppliersHandler } from './suppliers.handler';
import { categoriesHandler } from './categories.handler';
import { expenseLinesHandler } from './expense-lines.handler';
import { hrHandler } from './hr.handler';
import { ordersHandler } from './orders.handler';
import { helpHandler } from './help.handler';

export const CHAT_HANDLERS: ChatHandler[] = [
  salesHandler,
  purchasesHandler,
  expensesHandler,
  reportsHandler,
  vaultsHandler,
  invoicesHandler,
  suppliersHandler,
  categoriesHandler,
  expenseLinesHandler,
  hrHandler,
  ordersHandler,
  helpHandler,
].sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

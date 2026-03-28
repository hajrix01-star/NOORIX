import type { ChatHandler } from './types';
import { matches } from './utils';
import { isGeminiOpenModeEnabled } from '../../config/gemini.config';

export const helpHandler: ChatHandler = {
  priority: 100,
  intent: 'help',
  matchesIntent: (intent) => intent === 'help',
  /** تحيات عامة لا تُطابق هنا — تمر إلى Gemini (answerGeneral) عند GEMINI_OPEN_MODE */
  canHandle: (q) => matches(q, ['مساعدة', 'help', 'ماذا تسأل', 'اسئلة', 'أسئلة', 'ماذا يمكن', 'ماذا تعرف', 'ما الذي']),
  process: async (ctx) => {
    const q = (ctx?.query || '').toLowerCase();
    const isGreeting = /كيف الحال|مرحبا|أهلا|اهلا|السلام|hello|hi/.test(q);
    if (isGreeting && isGeminiOpenModeEnabled()) {
      return null;
    }
    if (isGreeting) {
      return {
        answerAr: 'أهلاً بك! أنا مساعد نوركس. اسألني عن المبيعات، الخزائن، التقارير، الموظفين، أو اكتب "مساعدة" لرؤية الأسئلة المدعومة.',
        answerEn: 'Hello! I\'m Noorix assistant. Ask me about sales, vaults, reports, employees, or type "help" for supported questions.',
      };
    }
    return {
      answerAr: `يمكنك السؤال عن:\n• مبيعات/مشتريات/مصروفات (اليوم، أمس، هذا الأسبوع، هذا الشهر، أو السنة)\n• أرصدة الخزائن\n• تقرير الربح والخسارة\n• عدد الفواتير، آخر فاتورة، الموردين، الفئات، بنود المصروفات\n• الموظفين، أسماء الموظفين، الرواتب، آخر مسيرة، الإجازات، الإقامات\n• أصناف الطلبات والمنتجات وفئات الطلبات`,
      answerEn: `You can ask about:\n• Sales/purchases/expenses (today, yesterday, this week, this month, or year)\n• Vault balances\n• Profit & Loss report\n• Invoice count, last invoice, suppliers, categories, expense lines\n• Employees, employee names, payroll, last payroll, leaves, residencies\n• Order products and categories`,
    };
  },
};

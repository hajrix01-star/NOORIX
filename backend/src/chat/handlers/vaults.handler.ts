import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';

export const vaultsHandler: ChatHandler = {
  priority: 14,
  intent: 'vaults',
  matchesIntent: (intent, can) => intent === 'vaults' && can(PERMISSIONS.VAULTS_READ),
  canHandle: (q, can) =>
    matches(q, ['خزائن', 'خزينة', 'رصيد', 'أرصدة', 'بنك', 'كاش', 'vault', 'balance', 'bank', 'cash']) &&
    can(PERMISSIONS.VAULTS_READ),
  process: async (ctx) => {
    const { companyId } = ctx;
    const { vaultsService } = ctx;
    const vaults = await vaultsService.findAll(companyId, false);
    if (vaults.length === 0) {
      return { answerAr: 'لا توجد خزائن مسجلة.', answerEn: 'No vaults registered.' };
    }
    const lines = vaults.map((v: { nameAr: string; balance?: number | null }) => `• ${v.nameAr}: ${Number(v.balance ?? 0).toLocaleString('en')} ﷼`);
    const total = vaults.reduce((s: number, v: { balance?: number | null }) => s + Number(v.balance ?? 0), 0);
    return {
      answerAr: `أرصدة الخزائن:\n${lines.join('\n')}\nالإجمالي: ${total.toLocaleString('en')} ﷼`,
      answerEn: `Vault balances:\n${vaults.map((v: { nameAr: string; nameEn?: string | null; balance?: number | null }) => `• ${v.nameEn || v.nameAr}: ${Number(v.balance ?? 0).toLocaleString('en')} SAR`).join('\n')}\nTotal: ${total.toLocaleString('en')} SAR`,
    };
  },
};

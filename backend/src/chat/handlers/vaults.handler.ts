import { formatReportMoneyInteger } from '../../common/utils/report-display-format.util';
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
    const total = vaults.reduce((s: number, v: { balance?: number | null }) => s + Number(v.balance ?? 0), 0);
    const fmtBal = (n: number) => formatReportMoneyInteger(n);
    const rowsAr = vaults.map(
      (v: { nameAr: string; balance?: number | null }) =>
        `${v.nameAr}\t${fmtBal(Number(v.balance ?? 0))} SR`,
    );
    const rowsEn = vaults.map(
      (v: { nameAr: string; nameEn?: string | null; balance?: number | null }) =>
        `${(v.nameEn || v.nameAr).trim()}\t${fmtBal(Number(v.balance ?? 0))} SAR`,
    );
    return {
      answerAr: ['## أرصدة الخزائن', '', 'الخزينة\tالرصيد', ...rowsAr, `الإجمالي\t${fmtBal(total)} SR`].join('\n'),
      answerEn: ['## Vault balances', '', 'Vault\tBalance', ...rowsEn, `Total\t${fmtBal(total)} SAR`].join('\n'),
    };
  },
};

import { vaultDisplayName } from '../../utils/vaultDisplay';

export const PAGE_SIZE = 50;

/** أقصى عدد أعمدة خزائن في تصدير Excel (اسم + نوع + مبلغ لكل خزينة) */
export const MAX_VAULT_SLOTS = 5;

export function vaultTypeLabelForExport(type: any, t: any) {
  const map: Record<string, string> = { cash: 'vaultTypeCash', bank: 'vaultTypeBank', app: 'vaultTypeApp' };
  const k = map[String(type)];
  return k ? t(k) : type ? String(type) : '—';
}

export function getAllocationsForExport(inv: any, lang: any, t: any) {
  const out = [];
  const a = inv.vaultAllocations;
  if (Array.isArray(a) && a.length > 0) {
    for (const al of a) {
      out.push({
        name: vaultDisplayName(al.vault, lang),
        type: vaultTypeLabelForExport(al.vault?.type, t),
        amount: Number(al.amount ?? 0),
      });
    }
    return out;
  }
  if (inv.vault) {
    out.push({
      name: vaultDisplayName(inv.vault, lang),
      type: vaultTypeLabelForExport(inv.vault?.type, t),
      amount: Number(inv.totalAmount ?? 0),
    });
  }
  return out;
}

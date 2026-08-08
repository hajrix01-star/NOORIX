import type {
  VaultCreatePayload,
  VaultRecord,
  VaultTransactionRecord,
  VaultTransactionViewRow,
  VaultType,
} from '../../types/api';
import { sumAmounts } from '../../utils/format';

export type VaultTypeOption = {
  value: VaultType;
  labelKey: string;
};

export type PaymentMethodOption = {
  value: string;
  labelKey: string;
};

export type VaultTypeInfo = {
  isCustom: false;
  emoji: null;
};

export type VaultFormState = {
  nameAr: string;
  nameEn: string;
  type: VaultType;
  isSalesChannel: boolean;
  showAsPaymentMethod: boolean;
  paymentMethod: string;
  notes: string;
};

export type TreasurySummary = {
  totalBalance: number;
  totalIn: number;
  totalOut: number;
};

export type SplitVaultGroups = {
  salesChannels: VaultRecord[];
  otherVaults: VaultRecord[];
  archivedVaults: VaultRecord[];
};

export function parseVaultType(type: string | null | undefined): VaultTypeInfo {
  return { isCustom: false, emoji: null };
}

export function compareVaultOrder(a: VaultRecord, b: VaultRecord): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.nameAr).localeCompare(String(b.nameAr), 'ar');
}

export function activeVisibleVaults(vaults: VaultRecord[]): VaultRecord[] {
  return vaults.filter((v) => v.isActive !== false && !v.isArchived);
}

export function splitVaultGroups(vaults: VaultRecord[], includeArchived: boolean): SplitVaultGroups {
  return {
    salesChannels: vaults
      .filter((v) => v.isActive !== false && v.isSalesChannel && !v.isArchived)
      .sort(compareVaultOrder),
    otherVaults: vaults
      .filter((v) => v.isActive !== false && !v.isSalesChannel && !v.isArchived)
      .sort(compareVaultOrder),
    archivedVaults: includeArchived
      ? vaults.filter((v) => v.isActive !== false && v.isArchived).sort(compareVaultOrder)
      : [],
  };
}

export function buildTreasurySummary(vaults: VaultRecord[]): TreasurySummary {
  const active = activeVisibleVaults(vaults);
  return {
    totalBalance: sumAmounts(active, 'balance').toNumber(),
    totalIn: active.reduce((sum, vault) => sum + Number(vault.externalIn ?? vault.totalIn ?? 0), 0),
    totalOut: active.reduce((sum, vault) => sum + Number(vault.externalOut ?? vault.totalOut ?? 0), 0),
  };
}

export function emptyVaultForm(): VaultFormState {
  return {
    nameAr: '',
    nameEn: '',
    type: 'cash',
    isSalesChannel: false,
    showAsPaymentMethod: true,
    paymentMethod: '',
    notes: '',
  };
}

export function initVaultForm(initial: VaultRecord | null): VaultFormState {
  if (!initial) return emptyVaultForm();
  return {
    nameAr: initial.nameAr || '',
    nameEn: initial.nameEn || '',
    type: initial.type || 'cash',
    isSalesChannel: initial.isSalesChannel ?? false,
    showAsPaymentMethod: initial.showAsPaymentMethod !== false,
    paymentMethod: initial.paymentMethod || '',
    notes: initial.notes || '',
  };
}

export function buildVaultSavePayload(form: VaultFormState): VaultCreatePayload {
  return {
    nameAr: form.nameAr.trim(),
    nameEn: form.nameEn.trim() || null,
    type: form.type,
    isSalesChannel: form.isSalesChannel,
    showAsPaymentMethod: form.showAsPaymentMethod,
    paymentMethod: form.showAsPaymentMethod ? form.paymentMethod || null : null,
    notes: form.notes.trim() || null,
  };
}

export function normalizeVaultTransactions(
  rows: VaultTransactionRecord[],
  accountId: string | undefined,
  formatNotes: (row: VaultTransactionRecord) => string | null,
): VaultTransactionViewRow[] {
  return rows.map((row) => {
    const amount = Number(row.amount ?? 0);
    const isDebit = row.debitAccountId === accountId;
    return {
      ...row,
      debit: isDebit ? amount : null,
      credit: !isDebit ? amount : null,
      notesDisplay: formatNotes(row),
    };
  });
}

export function sumVaultTransactionSide(rows: VaultTransactionViewRow[], key: 'debit' | 'credit'): number {
  return rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);
}

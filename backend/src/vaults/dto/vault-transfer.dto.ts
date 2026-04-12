import { z } from 'zod';

/**
 * تحويل بين خزائن — يمر عبر FinancialCoreService.processTransfer
 * (قيد واحد: مدين المستقبل، دائن المُرسِل) — بدون أثر على P&L.
 */
export const vaultTransferSchema = z.object({
  companyId:        z.string().min(1, 'معرف الشركة مطلوب'),
  fromVaultId:      z.string().min(1, 'خزينة المُرسِل مطلوبة'),
  toVaultId:        z.string().min(1, 'خزينة المستقبل مطلوبة'),
  amount:           z.string().min(1, 'المبلغ مطلوب').refine((s) => {
    const n = Number(String(s).replace(',', '.'));
    return Number.isFinite(n) && n > 0;
  }, 'المبلغ يجب أن يكون أكبر من صفر'),
  transactionDate:  z.string().min(1, 'تاريخ العملية مطلوب'),
  notes:            z.string().optional().nullable(),
  idempotencyKey:   z.string().optional().nullable(),
});

export type VaultTransferBody = z.infer<typeof vaultTransferSchema>;

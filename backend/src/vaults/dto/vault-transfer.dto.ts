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
  transactionDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ العملية يجب أن يكون بصيغة YYYY-MM-DD'),
  notes:            z.string().max(2000).optional().nullable(),
  idempotencyKey:   z.string().min(8, 'مفتاح منع التكرار مطلوب').max(200),
});

export const reverseVaultTransferSchema = z.object({
  companyId:       z.string().min(1, 'معرف الشركة مطلوب'),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ العكس يجب أن يكون بصيغة YYYY-MM-DD'),
  reason:          z.string().max(2000).optional().nullable(),
  idempotencyKey:  z.string().min(8, 'مفتاح منع تكرار العكس مطلوب').max(200),
});

export type VaultTransferBody = z.infer<typeof vaultTransferSchema>;
export type ReverseVaultTransferBody = z.infer<typeof reverseVaultTransferSchema>;

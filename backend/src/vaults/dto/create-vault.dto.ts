import { z } from 'zod';

export const createVaultSchema = z.object({
  companyId:      z.string().min(1, 'معرف الشركة مطلوب'),
  nameAr:         z.string().min(1, 'اسم الخزنة بالعربية مطلوب'),
  nameEn:         z.string().optional().nullable().or(z.literal('')),
  type:           z.enum(['cash', 'bank', 'app'], {
    errorMap: () => ({ message: 'نوع الخزنة: cash أو bank أو app' }),
  }).default('cash'),
  isSalesChannel: z.boolean().optional().default(false),
  showAsPaymentMethod: z.boolean().optional().default(true),
  paymentMethod:  z.string().optional().nullable(),
  notes:          z.string().optional().nullable(),
});

export const updateVaultSchema = z.object({
  nameAr:         z.string().min(1).optional(),
  nameEn:         z.string().optional().nullable(),
  type:           z.enum(['cash', 'bank', 'app']).optional(),
  isSalesChannel: z.boolean().optional(),
  showAsPaymentMethod: z.boolean().optional(),
  paymentMethod:  z.string().optional().nullable(),
  notes:          z.string().optional().nullable(),
});

export type CreateVaultDto = z.infer<typeof createVaultSchema>;
export type UpdateVaultDto = z.infer<typeof updateVaultSchema>;

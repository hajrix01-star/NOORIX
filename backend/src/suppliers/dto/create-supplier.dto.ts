import { z } from 'zod';

export const createSupplierSchema = z.object({
  companyId:          z.string().min(1, 'معرف الشركة مطلوب'),
  nameAr:             z.string().min(1, 'الاسم بالعربية مطلوب'),
  nameEn:             z.string().optional().nullable().or(z.literal('')),
  taxNumber: z.string()
    .refine(val => !val || /^\d{15}$/.test(val), 'الرقم الضريبي يجب أن يكون 15 رقماً بالضبط')
    .optional().nullable().or(z.literal('')),
  phone: z.string()
    .max(30, 'رقم الهاتف طويل جداً')
    .optional().nullable().or(z.literal('')),
  supplierCategoryId: z.string().optional().nullable(),
  // يقبل الصيغتين: مع s وبدون s (توافق frontend)
  supplierType: z
    .enum(['purchases', 'expenses', 'purchase', 'expense'])
    .transform((v) => (v === 'purchase' ? 'purchases' : v === 'expense' ? 'expenses' : v))
    .optional()
    .default('purchases'),
  isTaxRegistered: z.boolean().optional().default(true),
});

export type CreateSupplierDto = z.infer<typeof createSupplierSchema>;

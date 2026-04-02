import { z } from 'zod';

export const updateSupplierSchema = z.object({
  nameAr:             z.string().min(1, 'الاسم بالعربية مطلوب').optional(),
  nameEn:             z.string().optional().nullable().or(z.literal('')),
  taxNumber: z.string()
    .refine(val => !val || /^\d{15}$/.test(val), 'الرقم الضريبي يجب أن يكون 15 رقماً بالضبط')
    .optional().nullable().or(z.literal('')),
  phone: z.string()
    .refine(val => !val || /^05\d{8}$/.test(val), 'رقم الجوال يجب أن يبدأ بـ 05 ويكون 10 أرقام')
    .optional().nullable().or(z.literal('')),
  supplierCategoryId: z.string().optional().nullable(),
  supplierType: z
    .enum(['purchases', 'expenses', 'purchase', 'expense'])
    .transform((v) => (v === 'purchase' ? 'purchases' : v === 'expense' ? 'expenses' : v))
    .optional(),
});

export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;

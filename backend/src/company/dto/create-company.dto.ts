import { z } from 'zod';

const optionalUrlOrDataUrl = z
  .string()
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((v) => (v && v.trim() ? v : undefined));

export const createCompanySchema = z.object({
  nameAr: z.string().min(1, 'اسم الشركة بالعربية مطلوب'),
  nameEn: z.string().optional().nullable().or(z.literal('')),
  logoUrl: optionalUrlOrDataUrl,
  phone: z.string().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable().or(z.literal('')),
  taxNumber: z.string().optional().nullable().or(z.literal('')),
  email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
});

export type CreateCompanyDto = z.infer<typeof createCompanySchema>;

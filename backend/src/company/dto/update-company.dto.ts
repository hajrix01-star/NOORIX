import { z } from 'zod';

const optionalUrlOrDataUrl = z
  .string()
  .optional()
  .nullable()
  .or(z.literal(''))
  .transform((v) => (v && v.trim() ? v : undefined));

export const updateCompanySchema = z.object({
  nameAr: z.string().min(1).optional(),
  nameEn: z.string().optional().nullable(),
  logoUrl: optionalUrlOrDataUrl,
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
  email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  isArchived: z.boolean().optional(),
  vatEnabledForSales: z.boolean().optional(),
  vatRatePercent: z.number().min(0).max(100).optional(),
});
export type UpdateCompanyDto = z.infer<typeof updateCompanySchema>;

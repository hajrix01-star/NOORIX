export type ResidencyRecord = Record<string, unknown> & {
  id?: string | null;
  employeeId?: string | null;
  serviceCategory?: string | null;
  iqamaNumber?: string | null;
  referenceLabel?: string | null;
  issueDate?: string | Date | null;
  expiryDate?: string | Date | null;
  transactionDate?: string | Date | null;
  status?: string | null;
  notes?: string | null;
  invoiceId?: string | null;
  invoice?: { invoiceNumber?: string | number | null } | null;
  supplierId?: string | null;
  supplier?: { id?: string | null; nameAr?: string | null; nameEn?: string | null } | null;
  residencyInvoiceAmount?: number | string | null;
  metadata?: Record<string, unknown> | null;
};

export type VaultOption = {
  id?: string | null;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

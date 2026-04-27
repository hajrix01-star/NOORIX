import { Prisma } from '@prisma/client';
import { daysBetweenUtc, utcToday } from './company-assets-datetime.util';

export type WarrantyFilter = 'all' | 'active' | 'expired' | 'expiring90' | 'none';

export function mapWarrantyLine(l: {
  id: string;
  nameAr: string;
  nameEn: string | null;
  serialNumber: string | null;
  quantity: Prisma.Decimal | null;
  notes: string | null;
  sortOrder: number;
}) {
  return {
    id: l.id,
    nameAr: l.nameAr,
    nameEn: l.nameEn,
    serialNumber: l.serialNumber,
    quantity: l.quantity != null ? l.quantity.toString() : null,
    notes: l.notes,
    sortOrder: l.sortOrder,
  };
}

export function mapCompanyAssetRow(
  row: {
    id: string;
    nameAr: string;
    nameEn: string | null;
    serialNumber: string | null;
    location: string | null;
    purchaseDate: Date | null;
    acquisitionCost: Prisma.Decimal | null;
    warrantyDescription: string | null;
    warrantyMonths: number | null;
    warrantyStartDate: Date | null;
    warrantyEndDate: Date | null;
    notes: string | null;
    supplier: { id: string; nameAr: string; nameEn: string | null } | null;
    invoice: { id: string; invoiceNumber: string; supplierInvoiceNumber: string | null } | null;
    _count?: { warrantyLines: number };
    warrantyLines?: Array<{
      id: string;
      nameAr: string;
      nameEn: string | null;
      serialNumber: string | null;
      quantity: Prisma.Decimal | null;
      notes: string | null;
      sortOrder: number;
    }>;
  },
) {
  const today = utcToday();
  const end = row.warrantyEndDate;
  let warrantyStatus: 'none' | 'active' | 'expired' | 'expiring' = 'none';
  let daysToWarrantyEnd: number | null = null;
  if (end) {
    daysToWarrantyEnd = daysBetweenUtc(today, end);
    if (daysToWarrantyEnd < 0) warrantyStatus = 'expired';
    else if (daysToWarrantyEnd <= 90) warrantyStatus = 'expiring';
    else warrantyStatus = 'active';
  }
  const { _count, warrantyLines, ...rest } = row;
  return {
    ...rest,
    acquisitionCost: row.acquisitionCost != null ? row.acquisitionCost.toString() : null,
    warrantyStatus,
    daysToWarrantyEnd,
    warrantyLinesCount: _count?.warrantyLines ?? warrantyLines?.length ?? 0,
    warrantyLines: warrantyLines?.length ? warrantyLines.map((l) => mapWarrantyLine(l)) : undefined,
  };
}

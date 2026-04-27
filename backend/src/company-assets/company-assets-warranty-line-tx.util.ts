import { Prisma } from '@prisma/client';
import { WarrantyLineDto } from './dto/warranty-line.dto';

type Tx = Prisma.TransactionClient;

export async function createCompanyAssetWarrantyLinesTx(
  tx: Tx,
  tenantId: string,
  companyId: string,
  companyAssetId: string,
  lines: WarrantyLineDto[] | undefined,
): Promise<void> {
  if (!lines?.length) return;
  await tx.companyAssetWarrantyLine.createMany({
    data: lines.map((l, i) => ({
      tenantId,
      companyId,
      companyAssetId,
      sortOrder: i,
      nameAr: l.nameAr.trim(),
      nameEn: l.nameEn?.trim() || null,
      serialNumber: l.serialNumber?.trim() || null,
      quantity: l.quantity != null ? new Prisma.Decimal(String(l.quantity)) : null,
      notes: l.notes?.trim() || null,
    })),
  });
}

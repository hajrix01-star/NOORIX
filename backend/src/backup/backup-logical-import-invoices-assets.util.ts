import { Prisma } from '@prisma/client';
import {
  importSnapshotArr as arr,
  importSnapshotDec as dec,
  importSnapshotDdate as ddate,
} from './backup-logical-import-helpers.util';
import { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';
import { computeSupplierInvoiceDedupKeyForInvoiceRow } from '../invoice/invoice-supplier-invoice-dedup.util';

export async function importBackupLogicalInvoicesAndAssets(
  tx: Prisma.TransactionClient,
  p: BackupLogicalImportTxParams,
  maps: {
    categoryMap: Map<string, string>;
    supplierMap: Map<string, string>;
    vaultMap: Map<string, string>;
    expenseLineMap: Map<string, string>;
    employeeMap: Map<string, string>;
    dailySalesSummaryMap: Map<string, string>;
  },
): Promise<{ invoiceMap: Map<string, string> }> {
  const { tenantId, newCompanyId, data, nid } = p;
  const { categoryMap, supplierMap, vaultMap, expenseLineMap, employeeMap, dailySalesSummaryMap } = maps;
  const invoiceMap = new Map<string, string>();
  for (const inv of arr<Record<string, unknown>>(data.invoices)) {
    const id = nid();
    invoiceMap.set(String(inv.id), id);
    const supId = inv.supplierId ? supplierMap.get(String(inv.supplierId)) : undefined;
    const empId = inv.employeeId ? employeeMap.get(String(inv.employeeId)) : undefined;
    const exId = inv.expenseLineId ? expenseLineMap.get(String(inv.expenseLineId)) : undefined;
    const catId = inv.categoryId ? categoryMap.get(String(inv.categoryId)) : undefined;
    const vaultId = inv.vaultId ? vaultMap.get(String(inv.vaultId)) : undefined;
    const dssId = inv.dailySalesSummaryId
      ? dailySalesSummaryMap.get(String(inv.dailySalesSummaryId))
      : undefined;
    const pmId = inv.paymentMethodId ? vaultMap.get(String(inv.paymentMethodId)) : undefined;
    const invStatus = String(inv.status ?? 'active');
    const supInvNum = (inv.supplierInvoiceNumber as string | null) ?? null;
    const dedupFromSnap = inv.supplierInvoiceDedupKey;
    const supplierInvoiceDedupKey =
      dedupFromSnap != null && String(dedupFromSnap).trim() !== ''
        ? String(dedupFromSnap).trim().toLowerCase()
        : computeSupplierInvoiceDedupKeyForInvoiceRow({
            supplierId: supId ?? null,
            kind: String(inv.kind),
            supplierInvoiceNumber: supInvNum,
            status: invStatus,
          });
    await tx.invoice.create({
      data: {
        id,
        tenantId,
        companyId: newCompanyId,
        supplierId: supId ?? null,
        employeeId: empId ?? null,
        expenseLineId: exId ?? null,
        categoryId: catId ?? null,
        invoiceNumber: String(inv.invoiceNumber),
        supplierInvoiceNumber: supInvNum,
        supplierInvoiceDedupKey,
        kind: String(inv.kind),
        totalAmount: dec(inv.totalAmount),
        netAmount: dec(inv.netAmount),
        taxAmount: dec(inv.taxAmount),
        transactionDate: ddate(inv.transactionDate),
        invoiceDate: inv.invoiceDate ? ddate(inv.invoiceDate) : null,
        vaultId: vaultId ?? null,
        paymentMethodId: pmId ?? null,
        batchId: (inv.batchId as string | null) ?? null,
        notes: (inv.notes as string | null) ?? null,
        settledAt: inv.settledAt ? ddate(inv.settledAt) : null,
        settledAmount: inv.settledAmount != null ? dec(inv.settledAmount) : null,
        dailySalesSummaryId: dssId ?? null,
        status: String(inv.status ?? 'active'),
        entryDate: ddate(inv.entryDate),
        createdAt: ddate(inv.createdAt),
        updatedAt: ddate(inv.updatedAt),
      },
    });
  }

  for (const row of arr<Record<string, unknown>>(data.invoiceVaultAllocations ?? [])) {
    const invId = invoiceMap.get(String(row.invoiceId));
    const vid = vaultMap.get(String(row.vaultId));
    if (!invId || !vid) continue;
    await tx.invoiceVaultAllocation.create({
      data: {
        id: nid(),
        tenantId,
        invoiceId: invId,
        vaultId: vid,
        amount: dec(row.amount),
        createdAt: row.createdAt ? ddate(row.createdAt) : new Date(),
      },
    });
  }

  const companyAssetMap = new Map<string, string>();
  for (const row of arr<Record<string, unknown>>(data.companyAssets ?? [])) {
    const newRowId = nid();
    companyAssetMap.set(String(row.id), newRowId);
    const supId = row.supplierId ? supplierMap.get(String(row.supplierId)) : null;
    const invId = row.invoiceId ? invoiceMap.get(String(row.invoiceId)) : null;
    await tx.companyAsset.create({
      data: {
        id: newRowId,
        tenantId,
        companyId: newCompanyId,
        nameAr: String(row.nameAr),
        nameEn: (row.nameEn as string | null) ?? null,
        serialNumber: (row.serialNumber as string | null) ?? null,
        location: (row.location as string | null) ?? null,
        purchaseDate: row.purchaseDate ? ddate(row.purchaseDate) : null,
        acquisitionCost: row.acquisitionCost != null ? dec(row.acquisitionCost) : null,
        supplierId: supId,
        invoiceId: invId,
        warrantyDescription: (row.warrantyDescription as string | null) ?? null,
        warrantyMonths: row.warrantyMonths != null ? Number(row.warrantyMonths) : null,
        warrantyStartDate: row.warrantyStartDate ? ddate(row.warrantyStartDate) : null,
        warrantyEndDate: row.warrantyEndDate ? ddate(row.warrantyEndDate) : null,
        notes: (row.notes as string | null) ?? null,
        createdAt: ddate(row.createdAt),
        updatedAt: ddate(row.updatedAt),
      },
    });
  }

  for (const row of arr<Record<string, unknown>>(data.companyAssetWarrantyLines ?? [])) {
    const caId = companyAssetMap.get(String(row.companyAssetId));
    if (!caId) continue;
    await tx.companyAssetWarrantyLine.create({
      data: {
        id: nid(),
        tenantId,
        companyId: newCompanyId,
        companyAssetId: caId,
        sortOrder: Number(row.sortOrder ?? 0),
        nameAr: String(row.nameAr),
        nameEn: (row.nameEn as string | null) ?? null,
        serialNumber: (row.serialNumber as string | null) ?? null,
        quantity: row.quantity != null ? dec(row.quantity) : null,
        notes: (row.notes as string | null) ?? null,
        createdAt: ddate(row.createdAt),
        updatedAt: ddate(row.updatedAt),
      },
    });
  }

  return { invoiceMap };
}

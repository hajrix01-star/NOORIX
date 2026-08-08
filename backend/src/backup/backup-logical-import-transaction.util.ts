import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  importSnapshotArr as arr,
  importSnapshotDec as dec,
  importSnapshotDdate as ddate,
} from './backup-logical-import-helpers.util';
import { verifyImportedCompanyVaultAllocations } from './backup-logical-import-verify-allocations.util';
import { importBackupLogicalCoreEntities } from './backup-logical-import-core-entities.util';
import { importBackupLogicalInvoicesAndAssets } from './backup-logical-import-invoices-assets.util';
import { importBackupLogicalOperationalRecords } from './backup-logical-import-operational-records.util';
import { mapImportedLedgerRef } from './backup-logical-import-ledger-ref.util';
import { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';
import { importBackupLogicalPurchaseDebts } from './backup-logical-import-purchase-debts.util';
import { importBackupLogicalVaultTransfers } from './backup-logical-import-vault-transfers.util';

/**
 * جسم الاستيراد المنطقي داخل transaction — نفس التسلسل والخرائط.
 */
export async function runBackupLogicalImportInTransaction(
  tx: Prisma.TransactionClient,
  p: BackupLogicalImportTxParams,
): Promise<string[]> {
  const { tenantId, newCompanyId, data, importingUserId, strictAlloc, logger, nid } = p;
  let allocationWarnings: string[] = [];
  const { accountMap, categoryMap, supplierMap, vaultMap, expenseLineMap, employeeMap } =
    await importBackupLogicalCoreEntities(tx, p);
  const { dailySalesSummaryMap } =
    await importBackupLogicalOperationalRecords(tx, p, { categoryMap, supplierMap, vaultMap });

  const { invoiceMap } = await importBackupLogicalInvoicesAndAssets(tx, p, {
    categoryMap,
    supplierMap,
    vaultMap,
    expenseLineMap,
    employeeMap,
    dailySalesSummaryMap,
  });
  await importBackupLogicalPurchaseDebts(tx, p, { supplierMap, invoiceMap });

        // استثناء مقصود: استيراد لقطة منطقية — إعادة قيود من النسخة الاحتياطية (لا يمر بـ processOutflow/processInflow).
        const vaultTransferRows = arr<Record<string, unknown>>(data.vaultTransfers);
        const vaultTransferMap = new Map(
          vaultTransferRows.map((row) => [String(row.id), nid()]),
        );
        const vaultTransferByLedgerEntryId = new Map(
          vaultTransferRows
            .filter((row) => row.ledgerEntryId)
            .map((row) => [String(row.ledgerEntryId), vaultTransferMap.get(String(row.id))!]),
        );
        const ledgerEntryMap = new Map<string, string>();
        for (const le of arr<Record<string, unknown>>(data.ledgerEntries)) {
          const da = accountMap.get(String(le.debitAccountId));
          const ca = accountMap.get(String(le.creditAccountId));
          if (!da || !ca) continue;
          const vid = le.vaultId ? vaultMap.get(String(le.vaultId)) : undefined;
          const eid = le.employeeId ? employeeMap.get(String(le.employeeId)) : undefined;
          const refType = String(le.referenceType);
          const refId = mapImportedLedgerRef(refType, String(le.referenceId), {
            invoiceMap,
            dailySalesSummaryMap,
            transferMap: vaultTransferMap,
            transferByLedgerEntryId: vaultTransferByLedgerEntryId,
            ledgerEntryId: String(le.id),
          });
          const newLedgerEntryId = nid();
          ledgerEntryMap.set(String(le.id), newLedgerEntryId);
          await tx.ledgerEntry.create({
            data: {
              id: newLedgerEntryId,
              tenantId,
              companyId: newCompanyId,
              debitAccountId: da,
              creditAccountId: ca,
              amount: dec(le.amount),
              transactionDate: ddate(le.transactionDate),
              entryDate: ddate(le.entryDate),
              referenceType: refType,
              referenceId: refId,
              vaultId: vid ?? null,
              employeeId: eid ?? null,
              createdById: importingUserId,
              status: String(le.status ?? 'active'),
              createdAt: ddate(le.createdAt),
            },
          });
        }

        await importBackupLogicalVaultTransfers(tx, {
          tenantId,
          newCompanyId,
          data,
          importingUserId,
          nid,
          vaultMap,
          ledgerEntryMap,
          transferMap: vaultTransferMap,
        });

        const payrollRunMap = new Map<string, string>();
        for (const pr of arr<Record<string, unknown>>(data.payrollRuns)) {
          const id = nid();
          payrollRunMap.set(String(pr.id), id);
          await tx.payrollRun.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              runNumber: String(pr.runNumber),
              payrollMonth: ddate(pr.payrollMonth),
              totalAmount: dec(pr.totalAmount),
              employeeCount: Number(pr.employeeCount ?? 0),
              status: String(pr.status ?? 'draft'),
              notes: (pr.notes as string | null) ?? null,
              createdAt: ddate(pr.createdAt),
              updatedAt: ddate(pr.updatedAt),
            },
          });
        }

        const payrollRunItemMap = new Map<string, string>();
        for (const it of arr<Record<string, unknown>>(data.payrollRunItems)) {
          const prid = payrollRunMap.get(String(it.payrollRunId));
          const empid = employeeMap.get(String(it.employeeId));
          if (!prid || !empid) continue;
          const newRowId = nid();
          payrollRunItemMap.set(String(it.id), newRowId);
          await tx.payrollRunItem.create({
            data: {
              id: newRowId,
              payrollRunId: prid,
              employeeId: empid,
              grossSalary: dec(it.grossSalary),
              allowancesAdd: dec(it.allowancesAdd ?? 0),
              deductions: dec(it.deductions ?? 0),
              advancesDeduct: dec(it.advancesDeduct ?? 0),
              netSalary: dec(it.netSalary),
              notes: (it.notes as string | null) ?? null,
            },
          });
        }

        for (const v of arr<Record<string, unknown>>(data.payrollRunItemVaults)) {
          const pid = payrollRunItemMap.get(String(v.payrollItemId));
          const vid = vaultMap.get(String(v.vaultId));
          if (!pid || !vid) continue;
          await tx.payrollRunItemVault.create({
            data: {
              id: nid(),
              payrollItemId: pid,
              vaultId: vid,
              amount: dec(v.amount),
            },
          });
        }

        for (const v of arr<Record<string, unknown>>(data.payrollRunVaults ?? [])) {
          const prid = payrollRunMap.get(String(v.payrollRunId));
          const vid = vaultMap.get(String(v.vaultId));
          if (!prid || !vid) continue;
          await tx.payrollRunVault.create({
            data: {
              id: nid(),
              payrollRunId: prid,
              vaultId: vid,
              amount: dec(v.amount),
            },
          });
        }

        for (const row of arr<Record<string, unknown>>(data.leaves)) {
          const eid = employeeMap.get(String(row.employeeId));
          if (!eid) continue;
          await tx.leave.create({
            data: {
              id: nid(),
              tenantId,
              companyId: newCompanyId,
              employeeId: eid,
              leaveType: String(row.leaveType),
              startDate: ddate(row.startDate),
              endDate: ddate(row.endDate),
              daysCount: Number(row.daysCount),
              status: String(row.status ?? 'pending'),
              notes: (row.notes as string | null) ?? null,
              createdAt: ddate(row.createdAt),
              updatedAt: ddate(row.updatedAt),
            },
          });
        }

        for (const row of arr<Record<string, unknown>>(data.employeeResidencies)) {
          const eid = employeeMap.get(String(row.employeeId));
          if (!eid) continue;
          const invId = row.invoiceId ? invoiceMap.get(String(row.invoiceId)) : undefined;
          const supplierId = row.supplierId
            ? supplierMap.get(String(row.supplierId))
            : undefined;
          await tx.employeeResidency.create({
            data: {
              id: nid(),
              tenantId,
              companyId: newCompanyId,
              employeeId: eid,
              serviceCategory: String(row.serviceCategory ?? 'iqama_renewal'),
              iqamaNumber: row.iqamaNumber != null ? String(row.iqamaNumber) : null,
              referenceLabel: (row.referenceLabel as string | null) ?? null,
              issueDate: row.issueDate ? ddate(row.issueDate) : null,
              expiryDate: row.expiryDate ? ddate(row.expiryDate) : null,
              transactionDate: row.transactionDate ? ddate(row.transactionDate) : null,
              status: String(row.status ?? 'active'),
              notes: (row.notes as string | null) ?? null,
              metadata: row.metadata != null
                ? row.metadata as Prisma.InputJsonValue
                : undefined,
              supplierId: supplierId ?? null,
              invoiceId: invId ?? null,
              residencyInvoiceAmount:
                row.residencyInvoiceAmount != null ? dec(row.residencyInvoiceAmount) : null,
              createdAt: ddate(row.createdAt),
              updatedAt: ddate(row.updatedAt),
            },
          });
        }

        for (const row of arr<Record<string, unknown>>(data.employeeDocuments)) {
          const eid = employeeMap.get(String(row.employeeId));
          if (!eid) continue;
          await tx.employeeDocument.create({
            data: {
              id: nid(),
              tenantId,
              companyId: newCompanyId,
              employeeId: eid,
              documentType: String(row.documentType),
              fileName: String(row.fileName),
              filePath: (row.filePath as string | null) ?? null,
              fileSize: row.fileSize != null ? Number(row.fileSize) : null,
              notes: (row.notes as string | null) ?? null,
              createdAt: ddate(row.createdAt),
            },
          });
        }

        for (const row of arr<Record<string, unknown>>(data.employeeMovements)) {
          const eid = employeeMap.get(String(row.employeeId));
          if (!eid) continue;
          await tx.employeeMovement.create({
            data: {
              id: nid(),
              tenantId,
              companyId: newCompanyId,
              employeeId: eid,
              movementType: String(row.movementType),
              amount: row.amount != null ? dec(row.amount) : null,
              previousValue: (row.previousValue as string | null) ?? null,
              newValue: (row.newValue as string | null) ?? null,
              effectiveDate: ddate(row.effectiveDate),
              notes: (row.notes as string | null) ?? null,
              createdAt: ddate(row.createdAt),
            },
          });
        }

        for (const row of arr<Record<string, unknown>>(data.employeeCustomAllowances)) {
          const eid = employeeMap.get(String(row.employeeId));
          if (!eid) continue;
          await tx.employeeCustomAllowance.create({
            data: {
              id: nid(),
              tenantId,
              companyId: newCompanyId,
              employeeId: eid,
              nameAr: String(row.nameAr),
              amount: dec(row.amount),
              createdAt: ddate(row.createdAt),
            },
          });
        }

        for (const row of arr<Record<string, unknown>>(data.employeeDeductions)) {
          const eid = employeeMap.get(String(row.employeeId));
          if (!eid) continue;
          await tx.employeeDeduction.create({
            data: {
              id: nid(),
              tenantId,
              companyId: newCompanyId,
              employeeId: eid,
              deductionType: String(row.deductionType),
              amount: dec(row.amount),
              transactionDate: ddate(row.transactionDate),
              notes: (row.notes as string | null) ?? null,
              referenceId: row.referenceId
                ? invoiceMap.get(String(row.referenceId)) ?? (row.referenceId as string)
                : null,
              createdAt: ddate(row.createdAt),
            },
          });
        }

        await tx.userCompany.create({
          data: {
            id: nid(),
            userId: importingUserId,
            companyId: newCompanyId,
          },
        });

        allocationWarnings = await verifyImportedCompanyVaultAllocations(newCompanyId, tx);
        if (allocationWarnings.length > 0) {
          for (const w of allocationWarnings) logger.warn(`استيراد لقطة: ${w}`);
          if (strictAlloc) {
            throw new BadRequestException(
              `فشل الاستيراد — وضع التحقق الصارم من توزيعات الخزائن: ${allocationWarnings.join(' | ')}`,
            );
          }
        }
  return allocationWarnings;
}

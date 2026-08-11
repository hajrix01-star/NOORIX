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
import { reportingClassForHistoricalLedgerEntry } from '../financial-core/financial-reporting-classification.util';

/**
 * جسم الاستيراد المنطقي داخل transaction — نفس التسلسل والخرائط.
 */
export async function runBackupLogicalImportInTransaction(
  tx: Prisma.TransactionClient,
  p: BackupLogicalImportTxParams,
): Promise<string[]> {
  const { tenantId, newCompanyId, data, counts, importingUserId, strictAlloc, logger, nid } = p;
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

  const legacyCategoryById = new Map(
    arr<Record<string, unknown>>(data.categories).map((row) => [String(row.id), row]),
  );
  const legacyInvoiceCategoryById = new Map(
    arr<Record<string, unknown>>(data.invoices)
      .filter((row) => row.categoryId)
      .map((row) => [String(row.id), String(row.categoryId)]),
  );
  const legacyInvoiceKindById = new Map(
    arr<Record<string, unknown>>(data.invoices).map((row) => [String(row.id), String(row.kind ?? '')]),
  );
  const legacyAccountCodeById = new Map(
    arr<Record<string, unknown>>(data.accounts).map((row) => [String(row.id), String(row.code ?? '')]),
  );
  const legacyHrServiceCategoryByInvoiceId = new Map(
    arr<Record<string, unknown>>(data.employeeResidencies)
      .filter((row) => row.invoiceId)
      .map((row) => [String(row.invoiceId), String(row.serviceCategory ?? '')]),
  );

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
        const loanRows = arr<Record<string, unknown>>(data.loans);
        // A reversal references its original payment. Snapshots are not ordered,
        // so import originals first to satisfy the FK without weakening integrity.
        const loanPaymentRows = [...arr<Record<string, unknown>>(data.loanPayments)]
          .sort((a, b) => Number(Boolean(a.reversalOfId)) - Number(Boolean(b.reversalOfId)));
        const loanLegacyInvoiceRows = arr<Record<string, unknown>>(data.loanLegacyInvoices);
        if ((counts.loans != null && counts.loans !== loanRows.length)
          || (counts.loanPayments != null && counts.loanPayments !== loanPaymentRows.length)
          || (counts.loanLegacyInvoices != null && counts.loanLegacyInvoices !== loanLegacyInvoiceRows.length)) {
          throw new BadRequestException('LOAN_RESTORE_COUNT_MISMATCH');
        }
        const loanMap = new Map(loanRows.map((row) => [String(row.id), nid()]));
        const loanPaymentMap = new Map(loanPaymentRows.map((row) => [String(row.id), nid()]));
        const snapshotLedgerById = new Map(
          arr<Record<string, unknown>>(data.ledgerEntries).map((row) => [String(row.id), row]),
        );
        const snapshotAccountCodeById = new Map(
          arr<Record<string, unknown>>(data.accounts).map((row) => [String(row.id), String(row.code)]),
        );
        const snapshotVaultAccountById = new Map(
          arr<Record<string, unknown>>(data.vaults).map((row) => [String(row.id), String(row.accountId)]),
        );
        const snapshotLoanPaymentById = new Map(loanPaymentRows.map((row) => [String(row.id), row]));
        for (const row of loanRows) {
          const openingAmount = dec(row.openingAmount ?? row.originalAmount);
          const outstandingAmount = dec(row.outstandingAmount);
          const openingEntry = row.openingLedgerEntryId ? snapshotLedgerById.get(String(row.openingLedgerEntryId)) : null;
          if (!openingEntry || String(openingEntry.status ?? 'active') !== 'active'
            || String(openingEntry.referenceType) !== 'loan_opening'
            || String(openingEntry.referenceId) !== String(row.id)
            || !dec(openingEntry.amount).eq(openingAmount)
            || snapshotAccountCodeById.get(String(openingEntry.debitAccountId)) !== 'EQU-002'
            || snapshotAccountCodeById.get(String(openingEntry.creditAccountId)) !== 'LOAN-001') {
            throw new BadRequestException(`LOAN_RESTORE_OPENING_INTEGRITY_FAILED:${String(row.id)}`);
          }
          let expectedOutstanding = openingAmount;
          for (const payment of loanPaymentRows.filter((candidate) => String(candidate.loanId) === String(row.id))) {
            const isReversal = Boolean(payment.reversalOfId);
            const parent = isReversal ? snapshotLoanPaymentById.get(String(payment.reversalOfId)) : null;
            if (isReversal && (!parent
              || String(parent.loanId) !== String(row.id)
              || String(parent.id) === String(payment.id)
              || String(parent.reversalOfId ?? '') !== ''
              || String(parent.status ?? 'posted') !== 'reversed'
              || String(payment.status ?? 'posted') !== 'posted'
              || !dec(parent.amount).eq(dec(payment.amount)))) {
              throw new BadRequestException(`LOAN_PAYMENT_RESTORE_REVERSAL_INTEGRITY_FAILED:${String(payment.id)}`);
            }
            if (!isReversal && String(payment.status ?? 'posted') === 'reversed'
              && !loanPaymentRows.some((candidate) => String(candidate.reversalOfId ?? '') === String(payment.id))) {
              throw new BadRequestException(`LOAN_PAYMENT_RESTORE_REVERSAL_MISSING:${String(payment.id)}`);
            }
            const ledger = snapshotLedgerById.get(String(payment.ledgerEntryId));
            const vaultAccountId = snapshotVaultAccountById.get(String(payment.vaultId));
            const expectedType = isReversal ? 'loan_payment_reversal' : 'loan_payment';
            const debitOk = isReversal
              ? String(ledger?.debitAccountId) === vaultAccountId && snapshotAccountCodeById.get(String(ledger?.creditAccountId)) === 'LOAN-001'
              : snapshotAccountCodeById.get(String(ledger?.debitAccountId)) === 'LOAN-001' && String(ledger?.creditAccountId) === vaultAccountId;
            if (!ledger || String(ledger.status ?? 'active') !== 'active' || !vaultAccountId || String(ledger.referenceType) !== expectedType || String(ledger.referenceId) !== String(payment.id) || !dec(ledger.amount).eq(dec(payment.amount)) || !debitOk) {
              throw new BadRequestException(`LOAN_PAYMENT_RESTORE_LEDGER_INTEGRITY_FAILED:${String(payment.id)}`);
            }
            if (!isReversal && String(payment.status ?? 'posted') === 'posted') expectedOutstanding = expectedOutstanding.minus(dec(payment.amount));
          }
          if (expectedOutstanding.lt(0) || !expectedOutstanding.eq(outstandingAmount)) {
            throw new BadRequestException(`LOAN_RESTORE_OUTSTANDING_INTEGRITY_FAILED:${String(row.id)}`);
          }
        }
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
            loanMap,
            loanPaymentMap,
            ledgerEntryId: String(le.id),
          });
          const legacyReportingCategoryId = le.reportingCategoryId
            ? String(le.reportingCategoryId)
            : legacyInvoiceCategoryById.get(String(le.referenceId));
          const legacyReportingCategory = legacyReportingCategoryId
            ? legacyCategoryById.get(legacyReportingCategoryId)
            : undefined;
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
              reportingCategoryId: legacyReportingCategoryId ? categoryMap.get(legacyReportingCategoryId) ?? null : null,
              reportingCategoryNameAr: typeof le.reportingCategoryNameAr === 'string'
                ? le.reportingCategoryNameAr
                : typeof legacyReportingCategory?.nameAr === 'string' ? legacyReportingCategory.nameAr : null,
              reportingCategoryNameEn: typeof le.reportingCategoryNameEn === 'string'
                ? le.reportingCategoryNameEn
                : typeof legacyReportingCategory?.nameEn === 'string' ? legacyReportingCategory.nameEn : null,
              reportingClass: typeof le.reportingClass === 'string'
                ? le.reportingClass
                : reportingClassForHistoricalLedgerEntry(refType, {
                    invoiceKind: legacyInvoiceKindById.get(String(le.referenceId)),
                    creditAccountCode: legacyAccountCodeById.get(String(le.creditAccountId)),
                    hrServiceCategory: legacyHrServiceCategoryByInvoiceId.get(String(le.referenceId)),
                  }),
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

        for (const row of loanRows) {
          const id = loanMap.get(String(row.id));
          if (!id) throw new BadRequestException(`LOAN_RESTORE_ID_MISSING:${String(row.id)}`);
          const openingLedgerEntryId = row.openingLedgerEntryId ? ledgerEntryMap.get(String(row.openingLedgerEntryId)) : null;
          if (row.openingLedgerEntryId && !openingLedgerEntryId) throw new BadRequestException(`LOAN_RESTORE_OPENING_LEDGER_MISSING:${String(row.id)}`);
          await tx.loan.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              nameAr: String(row.nameAr),
              creditorName: (row.creditorName as string | null) ?? null,
              openingAmount: dec(row.openingAmount ?? row.originalAmount),
              outstandingAmount: dec(row.outstandingAmount),
              historicalPaymentsCount: Number(row.historicalPaymentsCount ?? 0),
              historicalPaidAmount: dec(row.historicalPaidAmount ?? 0),
              historicalPaidThroughDate: row.historicalPaidThroughDate ? ddate(row.historicalPaidThroughDate) : null,
              openingDate: ddate(row.openingDate),
              dueDate: row.dueDate ? ddate(row.dueDate) : null,
              notes: (row.notes as string | null) ?? null,
              isActive: row.isActive !== false,
              createdById: null,
              openingLedgerEntryId: openingLedgerEntryId ?? null,
              idempotencyKey: String(row.idempotencyKey ?? `backup-loan-${String(row.id)}`),
              requestHash: String(row.requestHash ?? `backup:${String(row.id)}`),
              createdAt: ddate(row.createdAt),
              updatedAt: ddate(row.updatedAt),
            },
          });
        }

        for (const row of loanPaymentRows) {
          const id = loanPaymentMap.get(String(row.id));
          const loanId = loanMap.get(String(row.loanId));
          const vaultId = vaultMap.get(String(row.vaultId));
          const ledgerEntryId = ledgerEntryMap.get(String(row.ledgerEntryId));
          if (!id || !loanId || !vaultId || !ledgerEntryId) throw new BadRequestException(`LOAN_PAYMENT_RESTORE_REFERENCE_MISSING:${String(row.id)}`);
          const reversalOfId = row.reversalOfId ? loanPaymentMap.get(String(row.reversalOfId)) : null;
          if (row.reversalOfId && !reversalOfId) throw new BadRequestException(`LOAN_PAYMENT_RESTORE_REVERSAL_MISSING:${String(row.id)}`);
          const sourceInvoiceId = row.sourceInvoiceId ? invoiceMap.get(String(row.sourceInvoiceId)) : null;
          const sourceLedgerEntryId = row.sourceLedgerEntryId ? ledgerEntryMap.get(String(row.sourceLedgerEntryId)) : null;
          if ((row.sourceInvoiceId && !sourceInvoiceId) || (row.sourceLedgerEntryId && !sourceLedgerEntryId)) throw new BadRequestException(`LOAN_PAYMENT_RESTORE_SOURCE_REFERENCE_MISSING:${String(row.id)}`);
          await tx.loanPayment.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              loanId,
              vaultId,
              ledgerEntryId,
              amount: dec(row.amount),
              transactionDate: ddate(row.transactionDate),
              notes: (row.notes as string | null) ?? null,
              createdById: null,
              idempotencyKey: String(row.idempotencyKey ?? `backup-loan-payment-${String(row.id)}`),
              requestHash: String(row.requestHash ?? `backup:${String(row.id)}`),
              status: String(row.status ?? 'posted'),
              reversalOfId: reversalOfId ?? null,
              reversedAt: row.reversedAt ? ddate(row.reversedAt) : null,
              sourceInvoiceId: sourceInvoiceId ?? null,
              sourceLedgerEntryId: sourceLedgerEntryId ?? null,
              createdAt: ddate(row.createdAt),
            },
          });
        }

        for (const row of loanLegacyInvoiceRows) {
          const loanId = loanMap.get(String(row.loanId));
          const invoiceId = invoiceMap.get(String(row.invoiceId));
          const sourceExpenseLineId = expenseLineMap.get(String(row.sourceExpenseLineId));
          if (!loanId || !invoiceId || !sourceExpenseLineId) throw new BadRequestException(`LOAN_LEGACY_INVOICE_RESTORE_REFERENCE_MISSING:${String(row.id)}`);
          await tx.loanLegacyInvoice.create({
            data: {
              id: nid(), tenantId, companyId: newCompanyId, loanId, invoiceId,
              sourceExpenseLineId,
              invoiceNumber: String(row.invoiceNumber), transactionDate: ddate(row.transactionDate), amount: dec(row.amount),
              convertedAt: row.convertedAt ? ddate(row.convertedAt) : null,
              convertedById: null,
              createdAt: ddate(row.createdAt),
            },
          });
        }

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
              kind: String(pr.kind ?? 'regular'),
              advanceSettlementsAppliedAt: pr.advanceSettlementsAppliedAt ? ddate(pr.advanceSettlementsAppliedAt) : null,
              payrollAccruedAt: pr.payrollAccruedAt ? ddate(pr.payrollAccruedAt) : null,
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
              advanceSelections: (it.advanceSelections as Prisma.InputJsonValue | null) ?? undefined,
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

import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  importSnapshotArr as arr,
  importSnapshotDec as dec,
  importSnapshotDdate as ddate,
} from './backup-logical-import-helpers.util';
import { verifyImportedCompanyVaultAllocations } from './backup-logical-import-verify-allocations.util';
import { computeSupplierInvoiceDedupKeyForInvoiceRow } from '../invoice/invoice-supplier-invoice-dedup.util';
import { createImportedCompany } from './backup-logical-import-company.util';
import { mapImportedLedgerRef } from './backup-logical-import-ledger-ref.util';
import { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';
import { normalizeSalesDayContextSnapshotInput, salesDayContextJson } from '../sales/sales-day-context.util';

/**
 * جسم الاستيراد المنطقي داخل transaction — نفس التسلسل والخرائط.
 */
export async function runBackupLogicalImportInTransaction(
  tx: Prisma.TransactionClient,
  p: BackupLogicalImportTxParams,
): Promise<string[]> {
  const { tenantId, newCompanyId, data, nameAr, resolvedNameEn, importingUserId, co, strictAlloc, logger, nid } = p;
  let allocationWarnings: string[] = [];
        await createImportedCompany(tx, { tenantId, newCompanyId, nameAr, resolvedNameEn, co });

        const accountMap = new Map<string, string>();
        for (const a of arr<Record<string, unknown>>(data.accounts)) {
          const id = nid();
          accountMap.set(String(a.id), id);
          await tx.account.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              code: String(a.code),
              nameAr: String(a.nameAr),
              nameEn: (a.nameEn as string | null) ?? null,
              type: String(a.type),
              icon: (a.icon as string | null) ?? null,
              taxExempt: Boolean(a.taxExempt),
              isActive: a.isActive !== false,
              createdAt: ddate(a.createdAt),
              updatedAt: ddate(a.updatedAt),
            },
          });
        }

        const categoryMap = new Map<string, string>();
        let catRemaining = arr<Record<string, unknown>>(data.categories);
        while (catRemaining.length) {
          const batch = catRemaining.filter((c) => {
            const p = c.parentId as string | null | undefined;
            return !p || categoryMap.has(String(p));
          });
          if (!batch.length) {
            throw new BadRequestException('تعذّر ترتيب فئات ذات تبعية دائرية');
          }
          for (const c of batch) {
            const id = nid();
            categoryMap.set(String(c.id), id);
            const accId = c.accountId ? accountMap.get(String(c.accountId)) : undefined;
            const parentId = c.parentId ? categoryMap.get(String(c.parentId)) : undefined;
            await tx.category.create({
              data: {
                id,
                tenantId,
                companyId: newCompanyId,
                accountId: accId ?? null,
                nameAr: String(c.nameAr),
                nameEn: (c.nameEn as string | null) ?? null,
                parentId: parentId ?? null,
                type: String(c.type ?? 'purchase'),
                icon: (c.icon as string | null) ?? null,
                isActive: c.isActive !== false,
                sortOrder: Number(c.sortOrder ?? 0),
                createdAt: ddate(c.createdAt),
                updatedAt: ddate(c.updatedAt),
              },
            });
          }
          const done = new Set(batch.map((c) => String(c.id)));
          catRemaining = catRemaining.filter((c) => !done.has(String(c.id)));
        }

        const supplierMap = new Map<string, string>();
        const directoryCodes = new Set(
          (await tx.supplierDirectoryEntry.findMany({ select: { id: true } }))
            .map((entry) => entry.id),
        );
        for (const s of arr<Record<string, unknown>>(data.suppliers)) {
          const id = nid();
          supplierMap.set(String(s.id), id);
          const sc = s.supplierCategoryId ? categoryMap.get(String(s.supplierCategoryId)) : undefined;
          const directoryEntryId = typeof s.directoryEntryId === 'string'
            && directoryCodes.has(s.directoryEntryId)
            ? s.directoryEntryId
            : null;
          await tx.supplier.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              nameAr: String(s.nameAr),
              nameEn: (s.nameEn as string | null) ?? null,
              phone: (s.phone as string | null) ?? null,
              taxNumber: (s.taxNumber as string | null) ?? null,
              categoryId: (s.categoryId as string | null) ?? null,
              supplierCategoryId: sc ?? null,
              directoryEntryId,
              directoryManaged: directoryEntryId ? Boolean(s.directoryManaged) : false,
              isTaxRegistered: s.isTaxRegistered !== false,
              isBookmarked: Boolean(s.isBookmarked),
              isDeleted: Boolean(s.isDeleted),
              createdAt: ddate(s.createdAt),
              updatedAt: ddate(s.updatedAt),
            },
          });
        }

        const vaultMap = new Map<string, string>();
        for (const v of arr<Record<string, unknown>>(data.vaults)) {
          const id = nid();
          vaultMap.set(String(v.id), id);
          const aid = accountMap.get(String(v.accountId));
          if (!aid) throw new BadRequestException('خزنة بدون حساب مطابق');
          await tx.vault.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              accountId: aid,
              nameAr: String(v.nameAr),
              nameEn: (v.nameEn as string | null) ?? null,
              type: String(v.type),
              isActive: v.isActive !== false,
              isArchived: Boolean(v.isArchived),
              isSalesChannel: Boolean(v.isSalesChannel),
              showAsPaymentMethod: (v as { showAsPaymentMethod?: boolean }).showAsPaymentMethod !== false,
              paymentMethod: (v.paymentMethod as string | null) ?? null,
              notes: (v.notes as string | null) ?? null,
              sortOrder: typeof (v as { sortOrder?: unknown }).sortOrder === 'number'
                ? ((v as { sortOrder: number }).sortOrder)
                : 0,
              createdAt: ddate(v.createdAt),
              updatedAt: ddate(v.updatedAt),
            },
          });
        }

        const expenseLineMap = new Map<string, string>();
        for (const e of arr<Record<string, unknown>>(data.expenseLines)) {
          const id = nid();
          expenseLineMap.set(String(e.id), id);
          const cid = categoryMap.get(String(e.categoryId));
          const sid = supplierMap.get(String(e.supplierId));
          if (!cid || !sid) throw new BadRequestException('بند مصروف بفئة/مورد غير موجود');
          await tx.expenseLine.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              nameAr: String(e.nameAr),
              nameEn: (e.nameEn as string | null) ?? null,
              kind: String(e.kind),
              categoryId: cid,
              supplierId: sid,
              serviceNumber: (e.serviceNumber as string | null) ?? null,
              notes: (e.notes as string | null) ?? null,
              isActive: e.isActive !== false,
              createdAt: ddate(e.createdAt),
              updatedAt: ddate(e.updatedAt),
            },
          });
        }

        const employeeMap = new Map<string, string>();
        for (const e of arr<Record<string, unknown>>(data.employees)) {
          const id = nid();
          employeeMap.set(String(e.id), id);
          await tx.employee.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              employeeSerial: String(e.employeeSerial),
              name: String(e.name),
              nameEn: (e.nameEn as string | null) ?? null,
              iqamaNumber: (e.iqamaNumber as string | null) ?? null,
              jobTitle: (e.jobTitle as string | null) ?? null,
              basicSalary: dec(e.basicSalary),
              housingAllowance: dec(e.housingAllowance ?? 0),
              transportAllowance: dec(e.transportAllowance ?? 0),
              otherAllowance: dec(e.otherAllowance ?? 0),
              workHours: (e.workHours as string | null) ?? null,
              workSchedule: (e.workSchedule as string | null) ?? null,
              joinDate: ddate(e.joinDate),
              status: String(e.status ?? 'active'),
              notes: (e.notes as string | null) ?? null,
              createdAt: ddate(e.createdAt),
              updatedAt: ddate(e.updatedAt),
            },
          });
        }

        for (const f of arr<Record<string, unknown>>(data.fiscalPeriods)) {
          await tx.fiscalPeriod.create({
            data: {
              id: nid(),
              tenantId,
              companyId: newCompanyId,
              nameAr: String(f.nameAr),
              nameEn: (f.nameEn as string | null) ?? null,
              startDate: ddate(f.startDate),
              endDate: ddate(f.endDate),
              status: String(f.status ?? 'open'),
              closedAt: f.closedAt ? ddate(f.closedAt) : null,
              closedById: null,
              createdAt: ddate(f.createdAt),
              updatedAt: ddate(f.updatedAt),
            },
          });
        }

        const dailySalesSummaryMap = new Map<string, string>();
        for (const s of arr<Record<string, unknown>>(data.dailySalesSummaries)) {
          const id = nid();
          dailySalesSummaryMap.set(String(s.id), id);
          await tx.dailySalesSummary.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              summaryNumber: String(s.summaryNumber),
              transactionDate: ddate(s.transactionDate),
              customerCount: Number(s.customerCount ?? 0),
              shift: s.shift === 'morning' || s.shift === 'evening' || s.shift === 'all' ? String(s.shift) : 'all',
              cashOnHand: dec(s.cashOnHand ?? 0),
              totalAmount: dec(s.totalAmount ?? 0),
              notes: (s.notes as string | null) ?? null,
              dayContext: salesDayContextJson(normalizeSalesDayContextSnapshotInput(s.dayContext)),
              status: String(s.status ?? 'active'),
              createdById: importingUserId,
              entryDate: ddate(s.entryDate),
              createdAt: ddate(s.createdAt),
              updatedAt: ddate(s.updatedAt),
            },
          });
        }

        for (const ch of arr<Record<string, unknown>>(data.dailySalesChannels)) {
          const sid = dailySalesSummaryMap.get(String(ch.summaryId));
          const vid = vaultMap.get(String(ch.vaultId));
          if (!sid || !vid) continue;
          await tx.dailySalesChannel.create({
            data: {
              id: nid(),
              summaryId: sid,
              vaultId: vid,
              amount: dec(ch.amount ?? 0),
            },
          });
        }

        const orderCategoryMap = new Map<string, string>();
        for (const o of arr<Record<string, unknown>>(data.orderCategories)) {
          const id = nid();
          orderCategoryMap.set(String(o.id), id);
          await tx.orderCategory.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              nameAr: String(o.nameAr),
              nameEn: (o.nameEn as string | null) ?? null,
              sortOrder: Number(o.sortOrder ?? 0),
              isActive: o.isActive !== false,
              createdAt: ddate(o.createdAt),
              updatedAt: ddate(o.updatedAt),
            },
          });
        }

        const orderProductMap = new Map<string, string>();
        for (const p of arr<Record<string, unknown>>(data.orderProducts)) {
          const id = nid();
          orderProductMap.set(String(p.id), id);
          const catId = p.categoryId ? orderCategoryMap.get(String(p.categoryId)) : undefined;
          await tx.orderProduct.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              categoryId: catId ?? null,
              nameAr: String(p.nameAr),
              nameEn: (p.nameEn as string | null) ?? null,
              unit: String(p.unit ?? 'piece'),
              sizes: (p.sizes as string | null) ?? null,
              packaging: (p.packaging as string | null) ?? null,
              lastPrice: dec(p.lastPrice ?? 0),
              variants: p.variants != null ? (p.variants as Prisma.InputJsonValue) : undefined,
              isActive: p.isActive !== false,
              sortOrder: Number(p.sortOrder ?? 0),
              createdAt: ddate(p.createdAt),
              updatedAt: ddate(p.updatedAt),
            },
          });
        }

        const orderMap = new Map<string, string>();
        for (const o of arr<Record<string, unknown>>(data.orders)) {
          const id = nid();
          orderMap.set(String(o.id), id);
          await tx.order.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              orderNumber: String(o.orderNumber),
              orderDate: ddate(o.orderDate),
              orderType: String(o.orderType),
              pettyCashAmount: o.pettyCashAmount != null ? dec(o.pettyCashAmount) : null,
              totalAmount: dec(o.totalAmount),
              notes: (o.notes as string | null) ?? null,
              status: String(o.status ?? 'active'),
              createdAt: ddate(o.createdAt),
              updatedAt: ddate(o.updatedAt),
            },
          });
        }

        for (const it of arr<Record<string, unknown>>(data.orderItems)) {
          const oid = orderMap.get(String(it.orderId));
          const pid = orderProductMap.get(String(it.productId));
          if (!oid || !pid) continue;
          await tx.orderItem.create({
            data: {
              id: nid(),
              orderId: oid,
              productId: pid,
              size: (it.size as string | null) ?? null,
              packaging: (it.packaging as string | null) ?? null,
              unit: (it.unit as string | null) ?? null,
              quantity: dec(it.quantity),
              unitPrice: dec(it.unitPrice),
              amount: dec(it.amount),
            },
          });
        }

        const bscatMap = new Map<string, string>();
        for (const c of arr<Record<string, unknown>>(data.bankStatementCategories)) {
          const id = nid();
          bscatMap.set(String(c.id), id);
          await tx.bankStatementCategory.create({
            data: {
              id,
              companyId: newCompanyId,
              nameAr: String(c.nameAr),
              nameEn: (c.nameEn as string | null) ?? null,
              color: String(c.color ?? '#6366f1'),
              sortOrder: Number(c.sortOrder ?? 0),
              createdAt: ddate(c.createdAt),
            },
          });
        }

        for (const t of arr<Record<string, unknown>>(data.bankTreeCategories)) {
          await tx.bankTreeCategory.create({
            data: {
              id: nid(),
              tenantId,
              companyId: newCompanyId,
              name: String(t.name),
              sortOrder: Number(t.sortOrder ?? 100),
              isActive: t.isActive !== false,
              transactionSide: String(t.transactionSide ?? 'any'),
              transactionType: (t.transactionType as string | null) ?? null,
              parentKeywords: (t.parentKeywords as Prisma.InputJsonValue) ?? {},
              classifications: (t.classifications as Prisma.InputJsonValue) ?? {},
            },
          });
        }

        for (const r of arr<Record<string, unknown>>(data.bankClassificationRules)) {
          await tx.bankClassificationRule.create({
            data: {
              id: nid(),
              tenantId,
              companyId: newCompanyId,
              keyword: String(r.keyword),
              matchType: String(r.matchType ?? 'contains'),
              categoryName: String(r.categoryName),
              transactionSide: String(r.transactionSide ?? 'any'),
              transactionType: (r.transactionType as string | null) ?? null,
              isActive: r.isActive !== false,
              priority: Number(r.priority ?? 0),
            },
          });
        }

        for (const tpl of arr<Record<string, unknown>>(data.bankStatementTemplates)) {
          await tx.bankStatementTemplate.create({
            data: {
              id: nid(),
              tenantId,
              companyId: newCompanyId,
              bankName: String(tpl.bankName),
              customerName: (tpl.customerName as string | null) ?? null,
              headerRow: Number(tpl.headerRow),
              dataStartRow: Number(tpl.dataStartRow),
              dataEndRow: Number(tpl.dataEndRow ?? -1),
              columnsJson: (tpl.columnsJson as Prisma.InputJsonValue) ?? {},
              dateFormat: (tpl.dateFormat as string | null) ?? null,
              sampleHeaders: (tpl.sampleHeaders as Prisma.InputJsonValue) ?? {},
              isActive: tpl.isActive !== false,
              usageCount: Number(tpl.usageCount ?? 0),
              lastUsedAt: tpl.lastUsedAt ? ddate(tpl.lastUsedAt) : null,
              createdAt: ddate(tpl.createdAt),
              updatedAt: ddate(tpl.updatedAt),
            },
          });
        }

        const bankStatementMap = new Map<string, string>();
        for (const b of arr<Record<string, unknown>>(data.bankStatements)) {
          const id = nid();
          bankStatementMap.set(String(b.id), id);
          await tx.bankStatement.create({
            data: {
              id,
              tenantId,
              companyId: newCompanyId,
              fileName: String(b.fileName),
              fileFormat: String(b.fileFormat),
              companyName: String(b.companyName),
              bankName: String(b.bankName),
              startDate: (b.startDate as string | null) ?? null,
              endDate: (b.endDate as string | null) ?? null,
              status: String(b.status ?? 'mapping'),
              headerRow: Number(b.headerRow ?? 0),
              dataStartRow: Number(b.dataStartRow ?? 0),
              dataEndRow: Number(b.dataEndRow ?? 0),
              columnMapping: b.columnMapping != null ? (b.columnMapping as Prisma.InputJsonValue) : undefined,
              totalDeposits: dec(b.totalDeposits ?? 0),
              totalWithdrawals: dec(b.totalWithdrawals ?? 0),
              transactionCount: Number(b.transactionCount ?? 0),
              rawData: b.rawData != null ? (b.rawData as Prisma.InputJsonValue) : undefined,
              summaryJson: b.summaryJson != null ? (b.summaryJson as Prisma.InputJsonValue) : undefined,
              aiAnalysis: (b.aiAnalysis as string | null) ?? null,
              createdAt: ddate(b.createdAt),
              updatedAt: ddate(b.updatedAt),
            },
          });
        }

        for (const tr of arr<Record<string, unknown>>(data.bankStatementTransactions)) {
          const sid = bankStatementMap.get(String(tr.statementId));
          if (!sid) continue;
          const catId = tr.categoryId ? bscatMap.get(String(tr.categoryId)) : undefined;
          await tx.bankStatementTransaction.create({
            data: {
              id: nid(),
              statementId: sid,
              txDate: String(tr.txDate),
              description: String(tr.description ?? ''),
              categoryId: catId ?? null,
              debit: dec(tr.debit ?? 0),
              credit: dec(tr.credit ?? 0),
              balance: tr.balance != null ? dec(tr.balance) : null,
              reference: (tr.reference as string | null) ?? null,
              note: (tr.note as string | null) ?? null,
              sortOrder: Number(tr.sortOrder ?? 0),
              matchKeyword: (tr.matchKeyword as string | null) ?? null,
              classificationName: (tr.classificationName as string | null) ?? null,
              transactionType: (tr.transactionType as string | null) ?? null,
              manuallyClassified: Boolean(tr.manuallyClassified),
            },
          });
        }

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

        // استثناء مقصود: استيراد لقطة منطقية — إعادة قيود من النسخة الاحتياطية (لا يمر بـ processOutflow/processInflow).
        for (const le of arr<Record<string, unknown>>(data.ledgerEntries)) {
          const da = accountMap.get(String(le.debitAccountId));
          const ca = accountMap.get(String(le.creditAccountId));
          if (!da || !ca) continue;
          const vid = le.vaultId ? vaultMap.get(String(le.vaultId)) : undefined;
          const eid = le.employeeId ? employeeMap.get(String(le.employeeId)) : undefined;
          const refType = String(le.referenceType);
          const refId = mapImportedLedgerRef(refType, String(le.referenceId), { invoiceMap, dailySalesSummaryMap });
          await tx.ledgerEntry.create({
            data: {
              id: nid(),
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
          await tx.employeeResidency.create({
            data: {
              id: nid(),
              tenantId,
              companyId: newCompanyId,
              employeeId: eid,
              iqamaNumber: String(row.iqamaNumber),
              issueDate: row.issueDate ? ddate(row.issueDate) : null,
              expiryDate: ddate(row.expiryDate),
              status: String(row.status ?? 'active'),
              notes: (row.notes as string | null) ?? null,
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

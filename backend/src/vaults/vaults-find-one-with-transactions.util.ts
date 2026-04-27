import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * جلب خزنة واحدة مع حركاتها المفلترة بالتاريخ + إثراء documentNumber / ملاحظات / تحويلات.
 */
export async function findOneWithTransactions(
  prisma: TenantPrismaService,
  id: string,
  companyId: string,
  startDate?: string,
  endDate?: string,
  page = 1,
  pageSize = 50,
) {
  const vault = await prisma.vault.findFirst({
    where: { id, companyId },
    include: { account: { select: { id: true, code: true, nameAr: true } } },
  });
  if (!vault) throw new NotFoundException('الخزنة غير موجودة');

  const dateFilter =
    startDate || endDate
      ? {
          transactionDate: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        }
      : {};

  const where: Prisma.LedgerEntryWhereInput = {
    companyId,
    status: 'active',
    ...dateFilter,
    OR: [
      { vaultId: id },
      {
        referenceType: 'transfer',
        OR: [
          { debitAccountId: vault.accountId },
          { creditAccountId: vault.accountId },
        ],
      },
    ],
  };

  const [items, total, debitAgg, creditAgg] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ledgerEntry.count({ where }),
    prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { companyId, debitAccountId: vault.accountId, status: 'active' },
    }),
    prisma.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { companyId, creditAccountId: vault.accountId, status: 'active' },
    }),
  ]);

  const totalIn = new Decimal(debitAgg._sum.amount ?? 0);
  const totalOut = new Decimal(creditAgg._sum.amount ?? 0);
  const balance = totalIn.minus(totalOut);

  const docNumMap = new Map<string, string>();
  const refs = [...new Set(items.map((e) => `${e.referenceType}:${e.referenceId}`))];
  const invoiceIds: string[] = [];
  const saleIds: string[] = [];
  for (const ref of refs) {
    const colonIdx = ref.indexOf(':');
    if (colonIdx < 0) continue;
    const refType = ref.slice(0, colonIdx);
    const refId = ref.slice(colonIdx + 1);
    if (!refId) continue;
    if (refType === 'invoice' || refType === 'salary' || refType === 'advance') {
      invoiceIds.push(refId);
    } else if (refType === 'sale') {
      saleIds.push(refId);
    }
  }
  let invoiceNoteMap = new Map<string, string | null>();
  let saleNoteMap = new Map<string, string | null>();
  try {
    if (invoiceIds.length > 0) {
      const invs = await prisma.invoice.findMany({
        where: { id: { in: invoiceIds }, companyId },
        select: { id: true, invoiceNumber: true, notes: true },
      });
      const invMap = new Map(invs.map((i) => [i.id, i.invoiceNumber]));
      invoiceNoteMap = new Map(invs.map((i) => [i.id, i.notes]));
      for (const ref of refs) {
        const refId = ref.slice(ref.indexOf(':') + 1);
        if (invMap.has(refId)) docNumMap.set(ref, invMap.get(refId)!);
      }
    }
    if (saleIds.length > 0) {
      const sales = await prisma.dailySalesSummary.findMany({
        where: { id: { in: saleIds }, companyId },
        select: { id: true, summaryNumber: true, notes: true },
      });
      const saleMap = new Map(sales.map((s) => [s.id, s.summaryNumber]));
      saleNoteMap = new Map(sales.map((s) => [s.id, s.notes]));
      for (const ref of refs) {
        const refId = ref.slice(ref.indexOf(':') + 1);
        if (saleMap.has(refId)) docNumMap.set(ref, saleMap.get(refId)!);
      }
    }
    for (const ref of refs) {
      if (!docNumMap.has(ref)) {
        const refId = ref.slice(ref.indexOf(':') + 1);
        docNumMap.set(ref, refId);
      }
    }
  } catch {
    for (const ref of refs) {
      if (!docNumMap.has(ref)) {
        const refId = ref.slice(ref.indexOf(':') + 1);
        docNumMap.set(ref, refId);
      }
    }
  }

  const transferEntryIds = items.filter((e) => e.referenceType === 'transfer').map((e) => e.id);
  const transferAccountIds = new Set<string>();
  for (const e of items) {
    if (e.referenceType !== 'transfer') continue;
    transferAccountIds.add(e.debitAccountId);
    transferAccountIds.add(e.creditAccountId);
  }

  const [transferAudits, vaultsForTransfers] = await Promise.all([
    transferEntryIds.length > 0
      ? prisma.auditLog.findMany({
          where: {
            companyId,
            entity: 'transfer',
            entityId: { in: transferEntryIds },
          },
          select: { entityId: true, newValue: true },
        })
      : Promise.resolve([]),
    transferAccountIds.size > 0
      ? prisma.vault.findMany({
          where: { companyId, accountId: { in: [...transferAccountIds] } },
          select: { id: true, accountId: true, nameAr: true, nameEn: true },
        })
      : Promise.resolve([]),
  ]);

  const vaultByAccountId = new Map(vaultsForTransfers.map((v) => [v.accountId, v]));
  const transferAuditNotesByLedgerId = new Map<string, string | null>();
  for (const a of transferAudits) {
    const nv = a.newValue as Record<string, unknown> | null;
    const raw = nv && typeof nv.notes === 'string' ? nv.notes.trim() : '';
    transferAuditNotesByLedgerId.set(a.entityId, raw || null);
  }

  const enrichedItems = items.map((e) => {
    const key = `${e.referenceType}:${e.referenceId}`;
    const docNum = docNumMap.get(key) ?? e.referenceId ?? null;
    let operationNotes: string | null = null;
    let transferFromVaultId: string | null = null;
    let transferToVaultId: string | null = null;
    let transferFromVaultNameAr: string | null = null;
    let transferToVaultNameAr: string | null = null;
    let transferFromVaultNameEn: string | null = null;
    let transferToVaultNameEn: string | null = null;

    if (e.referenceType === 'invoice' || e.referenceType === 'salary' || e.referenceType === 'advance') {
      const n = invoiceNoteMap.get(e.referenceId);
      operationNotes = typeof n === 'string' && n.trim() ? n.trim() : null;
    } else if (e.referenceType === 'sale') {
      const n = saleNoteMap.get(e.referenceId);
      operationNotes = typeof n === 'string' && n.trim() ? n.trim() : null;
    } else if (e.referenceType === 'transfer') {
      operationNotes = transferAuditNotesByLedgerId.get(e.id) ?? null;
      const fromV = vaultByAccountId.get(e.creditAccountId);
      const toV = vaultByAccountId.get(e.debitAccountId);
      if (fromV) {
        transferFromVaultId = fromV.id;
        transferFromVaultNameAr = fromV.nameAr;
        transferFromVaultNameEn = fromV.nameEn ?? null;
      }
      if (toV) {
        transferToVaultId = toV.id;
        transferToVaultNameAr = toV.nameAr;
        transferToVaultNameEn = toV.nameEn ?? null;
      }
    }

    return {
      ...e,
      documentNumber: docNum,
      operationNotes,
      transferFromVaultId,
      transferToVaultId,
      transferFromVaultNameAr,
      transferToVaultNameAr,
      transferFromVaultNameEn,
      transferToVaultNameEn,
    };
  });

  return {
    vault: {
      ...vault,
      totalIn: totalIn.toNumber(),
      totalOut: totalOut.toNumber(),
      balance: balance.toNumber(),
    },
    transactions: { items: enrichedItems, total, page, pageSize },
  };
}

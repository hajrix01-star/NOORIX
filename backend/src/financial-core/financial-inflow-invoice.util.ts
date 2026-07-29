import { Prisma } from '@prisma/client';
import type { SalesChannelDto } from './dto/financial-operation.dto';
import type { TxClient } from './financial-core-helpers.util';

type InflowInvoiceMoney = Prisma.Decimal;

type CreateInflowSaleInvoiceInput = {
  tx: TxClient;
  tenantId: string;
  companyId: string;
  userId: string;
  summaryId: string;
  summaryNumber: string;
  entryDate: Date;
  txDate: Date;
  totalAmount: InflowInvoiceMoney;
  totalNet: InflowInvoiceMoney;
  totalTax: InflowInvoiceMoney;
  vatEnabled: boolean;
  activeChannels: SalesChannelDto[];
  notes?: string | null;
};

type UpdateInflowSaleInvoiceInput = {
  tx: TxClient;
  tenantId: string;
  companyId: string;
  summaryId: string;
  txDate: Date;
  totalAmount: InflowInvoiceMoney;
  totalNet: InflowInvoiceMoney;
  totalTax: InflowInvoiceMoney;
  vatEnabled: boolean;
  activeChannels: SalesChannelDto[];
};

export async function createInflowSaleInvoiceWithAllocations({
  tx,
  tenantId,
  companyId,
  userId,
  summaryId,
  summaryNumber,
  entryDate,
  txDate,
  totalAmount,
  totalNet,
  totalTax,
  vatEnabled,
  activeChannels,
  notes,
}: CreateInflowSaleInvoiceInput) {
  const saleInvoice = await tx.invoice.create({
    data: {
      tenantId,
      companyId,
      invoiceNumber: summaryNumber,
      kind: 'sale',
      totalAmount,
      netAmount: vatEnabled ? totalNet : totalAmount,
      taxAmount: vatEnabled ? totalTax : new Prisma.Decimal(0),
      transactionDate: txDate,
      entryDate,
      vaultId: activeChannels.length === 1 ? activeChannels[0].vaultId : null,
      notes: notes ?? null,
      dailySalesSummaryId: summaryId,
      status: 'active',
      createdByUserId: userId,
    },
  });
  await tx.invoiceVaultAllocation.createMany({
    data: activeChannels.map((channel) => ({
      tenantId,
      invoiceId: saleInvoice.id,
      vaultId: channel.vaultId,
      amount: new Prisma.Decimal(channel.amount),
    })),
  });
  return saleInvoice;
}

export async function updateInflowSaleInvoiceWithAllocations({
  tx,
  tenantId,
  companyId,
  summaryId,
  txDate,
  totalAmount,
  totalNet,
  totalTax,
  vatEnabled,
  activeChannels,
}: UpdateInflowSaleInvoiceInput): Promise<void> {
  const saleInvoice = await tx.invoice.findFirst({
    where: { dailySalesSummaryId: summaryId, companyId },
  });
  if (!saleInvoice) return;

  await tx.invoiceVaultAllocation.deleteMany({ where: { invoiceId: saleInvoice.id } });
  await tx.invoiceVaultAllocation.createMany({
    data: activeChannels.map((channel) => ({
      tenantId,
      invoiceId: saleInvoice.id,
      vaultId: channel.vaultId,
      amount: new Prisma.Decimal(channel.amount),
    })),
  });
  await tx.invoice.update({
    where: { id: saleInvoice.id },
    data: {
      transactionDate: txDate,
      totalAmount,
      netAmount: vatEnabled ? totalNet : totalAmount,
      taxAmount: vatEnabled ? totalTax : new Prisma.Decimal(0),
      vaultId: activeChannels.length === 1 ? activeChannels[0].vaultId : null,
    },
  });
}

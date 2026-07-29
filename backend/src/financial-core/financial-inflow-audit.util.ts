import type { SalesChannelDto, SalesShift } from './dto/financial-operation.dto';
import type { JsonObject, TxClient } from './financial-core-helpers.util';

type InflowAuditBase = {
  tx: TxClient;
  tenantId: string;
  companyId: string;
  userId: string;
  entryDate: Date;
  totalAmount: { toString(): string };
  customerCount: number;
  shift: SalesShift;
  activeChannels: SalesChannelDto[];
};

type CreateInflowAuditInput = InflowAuditBase & {
  summaryId: string;
  summaryNumber: string;
};

type UpdateInflowAuditInput = InflowAuditBase & {
  summaryId: string;
};

export async function createInflowSummaryAuditLog({
  tx,
  tenantId,
  companyId,
  userId,
  entryDate,
  summaryId,
  summaryNumber,
  totalAmount,
  customerCount,
  shift,
  activeChannels,
}: CreateInflowAuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId,
      companyId,
      userId,
      action: 'create',
      entity: 'daily_sales_summary',
      entityId: summaryId,
      newValue: {
        summaryNumber,
        totalAmount: totalAmount.toString(),
        customerCount,
        shift,
        channelCount: activeChannels.length,
      } as JsonObject,
      createdAt: entryDate,
    },
  });
}

export async function updateInflowSummaryAuditLog({
  tx,
  tenantId,
  companyId,
  userId,
  entryDate,
  summaryId,
  totalAmount,
  customerCount,
  shift,
  activeChannels,
}: UpdateInflowAuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId,
      companyId,
      userId,
      action: 'update',
      entity: 'daily_sales_summary',
      entityId: summaryId,
      newValue: {
        totalAmount: totalAmount.toString(),
        customerCount,
        shift,
        channelCount: activeChannels.length,
      } as JsonObject,
      createdAt: entryDate,
    },
  });
}

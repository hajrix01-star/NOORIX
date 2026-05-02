/**
 * قنوات إدخال المبيعات اليومية — مستخرج من FinancialInflowService (ميثاق ≤450 سطر).
 */
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { splitTax, toHalalas } from '../common/utils/math-engine';

export type InflowChannelInput = { vaultId: string; amount: string };

export function assertInflowNotFutureDate(txDate: Date): void {
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (txDate > todayEnd) {
    throw new BadRequestException('لا يمكن إدخال أو تعديل مبيعات بتاريخ مستقبلي.');
  }
}

export function assertInflowChannelsListNonEmpty(channels: InflowChannelInput[] | undefined): void {
  if (!channels?.length) {
    throw new BadRequestException('يجب إدخال قناة بيع واحدة على الأقل.');
  }
}

export function filterPositiveInflowChannels(channels: InflowChannelInput[]): InflowChannelInput[] {
  return channels.filter((ch) => new Prisma.Decimal(ch.amount || '0').gt(0));
}

export function sumInflowChannelAmounts(channels: InflowChannelInput[]): Prisma.Decimal {
  return channels.reduce(
    (sum, ch) => sum.plus(new Prisma.Decimal(ch.amount || '0')),
    new Prisma.Decimal(0),
  );
}

export function assertInflowTotalPositive(total: Prisma.Decimal): void {
  if (total.lte(0)) {
    throw new BadRequestException('يجب أن يكون إجمالي المبيعات أكبر من صفر.');
  }
}

export type ChannelNetTaxRow = { net: Prisma.Decimal; tax: Prisma.Decimal };

/** صافي وضريبة لكل قناة + المجاميع (نفس منطق processInflow / updateInflow) */
export function buildChannelNetTaxForInflow(
  activeChannels: InflowChannelInput[],
  vatEnabled: boolean,
  vatRateDecimal: number,
): { channelNetTax: ChannelNetTaxRow[]; totalNet: Prisma.Decimal; totalTax: Prisma.Decimal } {
  let totalNet = new Prisma.Decimal(0);
  let totalTax = new Prisma.Decimal(0);
  const channelNetTax: ChannelNetTaxRow[] = [];
  for (const ch of activeChannels) {
    const amt = new Prisma.Decimal(ch.amount || '0');
    if (vatEnabled) {
      // صافي مُقرَّب إلى هللتين ثم ضريبة = إجمالي القناة − الصافي حتى لا يبقى فرق تُخفيه toFixed(4) في رسالة التوازن.
      const gross = new Decimal(amt.toString());
      const { net } = splitTax(gross, vatRateDecimal);
      const netRounded = toHalalas(net);
      const taxBalanced = gross.minus(netRounded);
      const netP = new Prisma.Decimal(netRounded.toString());
      const taxP = new Prisma.Decimal(taxBalanced.toString());
      channelNetTax.push({ net: netP, tax: taxP });
      totalNet = totalNet.plus(netP);
      totalTax = totalTax.plus(taxP);
    } else {
      channelNetTax.push({ net: amt, tax: new Prisma.Decimal(0) });
      totalNet = totalNet.plus(amt);
    }
  }
  return { channelNetTax, totalNet, totalTax };
}

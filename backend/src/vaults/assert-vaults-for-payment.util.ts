import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type VaultClient = {
  vault: {
    findMany: (args: Prisma.VaultFindManyArgs) => Promise<
      { id: string; nameAr: string; isActive: boolean; showAsPaymentMethod: boolean; isArchived: boolean }[]
    >;
  };
};

/**
 * سداد / رواتب / HR: الخزن يجب أن تكون فعّالة وغير مؤرشفة و«ظهور كطريقة سداد».
 * يستعمل `this.prisma` في HR ويمكن تمرير `tx` داخل financial-core لاحقاً لنفس التوقيع.
 */
export async function assertVaultsUsableForPayment(
  db: VaultClient,
  companyId: string,
  vaultIds: string[],
): Promise<void> {
  const ids = [...new Set(vaultIds.filter(Boolean))];
  if (!ids.length) return;
  const vaults = await db.vault.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, nameAr: true, isActive: true, showAsPaymentMethod: true, isArchived: true },
  });
  const byId = new Map(vaults.map((v) => [v.id, v]));
  for (const id of ids) {
    const v = byId.get(id);
    if (!v) throw new BadRequestException('خزنة غير موجودة أو لا تنتمي للشركة.');
    if (v.isActive === false) throw new BadRequestException(`الخزينة «${v.nameAr}» غير نشطة.`);
    if (v.isArchived) throw new BadRequestException(`الخزينة «${v.nameAr}» مؤرشفة.`);
    if (v.showAsPaymentMethod === false) {
      throw new BadRequestException(
        `الخزينة «${v.nameAr}» غير متاحة للسداد. فعّل «الظهور كطريقة سداد» من شاشة الخزائن.`,
      );
    }
  }
}

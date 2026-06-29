import { BadRequestException } from '@nestjs/common';

export function requireCompanyId(companyId: string | null | undefined): string {
  const id = String(companyId ?? '').trim();
  if (!id) {
    throw new BadRequestException('companyId مطلوب');
  }
  return id;
}

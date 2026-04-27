import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { isSuperAdmin } from '../auth/constants/permissions';

export function assertBankClassificationSourceCompanyAccessible(
  sourceCompanyId: string,
  targetCompanyId: string,
  user: { companyIds?: string[]; role?: string },
): void {
  if (sourceCompanyId === targetCompanyId) {
    throw new BadRequestException('شركة المصدر يجب أن تختلف عن الشركة الحالية.');
  }
  if (!isSuperAdmin(String(user?.role || '').toLowerCase())) {
    const ids = user?.companyIds || [];
    if (!ids.includes(sourceCompanyId)) {
      throw new ForbiddenException('غير مصرح لك بالوصول لشركة المصدر.');
    }
  }
}

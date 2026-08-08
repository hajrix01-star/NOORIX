import { BadRequestException } from '@nestjs/common';
import {
  requiresExpiryDate,
  requiresIqamaNumber,
  requiresReferenceLabel,
  requiresVisaDurationMonths,
} from './constants/employee-hr-service-categories';

export type ResidencyServicePayload = {
  iqamaNumber?: string;
  referenceLabel?: string;
  expiryDate?: string;
  visaDurationMonths?: number;
};

export function validateResidencyServicePayload(category: string, dto: ResidencyServicePayload) {
  if (requiresIqamaNumber(category) && !dto.iqamaNumber?.trim()) {
    throw new BadRequestException('رقم الإقامة مطلوب لهذا النوع من الخدمة.');
  }
  if (requiresExpiryDate(category) && !dto.expiryDate) {
    throw new BadRequestException('تاريخ الانتهاء مطلوب لهذا النوع من الخدمة.');
  }
  if (requiresReferenceLabel(category) && !dto.referenceLabel?.trim()) {
    throw new BadRequestException('رقم الشهادة الصحية مطلوب.');
  }
  if (requiresVisaDurationMonths(category)) {
    const months = dto.visaDurationMonths;
    if (months == null || months < 1 || months > 5) {
      throw new BadRequestException('مدة التأشيرة مطلوبة (من شهر إلى 5 أشهر).');
    }
  }
}

export function showsResidencyIssueDate(category: string): boolean {
  return ['iqama_renewal', 'medical_insurance', 'health_certificate'].includes(category);
}

export function mapResidencyDateFields(dto: {
  issueDate?: string;
  expiryDate?: string;
  transactionDate?: string;
}) {
  return {
    issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
    expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
    transactionDate: dto.transactionDate ? new Date(dto.transactionDate) : null,
  };
}

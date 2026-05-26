/**
 * قواعد دفعة ملخصات المبيعات — يوم كامل لا يُجمع مع شفتين في نفس الدفعة.
 */
import { BadRequestException } from '@nestjs/common';
import type { InflowDto } from './dto/financial-operation.dto';

function normalizeShift(value: unknown): 'morning' | 'evening' | 'all' {
  if (value === 'morning' || value === 'evening' || value === 'all') return value;
  return 'all';
}

export function assertValidInflowBatch(dtos: InflowDto[]): void {
  if (!dtos?.length) {
    throw new BadRequestException('يجب إدخال ملخص واحد على الأقل.');
  }
  if (dtos.length > 2) {
    throw new BadRequestException('لا يمكن حفظ أكثر من ملخصين (شفت صباحي ومسائي) في عملية واحدة.');
  }

  const companyId = dtos[0].companyId;
  const txDate = dtos[0].transactionDate;
  for (const d of dtos) {
    if (d.companyId !== companyId) {
      throw new BadRequestException('جميع الملخصات في الدفعة يجب أن تكون لنفس الشركة.');
    }
    if (d.transactionDate !== txDate) {
      throw new BadRequestException('جميع الملخصات في الدفعة يجب أن تكون لنفس التاريخ.');
    }
  }

  const shifts = dtos.map((d) => normalizeShift(d.shift));
  if (shifts.includes('all') && dtos.length > 1) {
    throw new BadRequestException('ملخص «يوم كامل» لا يُجمع مع شفت صباحي أو مسائي في نفس الحفظ.');
  }
  if (new Set(shifts).size !== shifts.length) {
    throw new BadRequestException('لا يمكن تكرار نفس الشفت في دفعة واحدة.');
  }
}

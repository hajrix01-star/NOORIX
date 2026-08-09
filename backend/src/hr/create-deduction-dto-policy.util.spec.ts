import { ValidationPipe } from '@nestjs/common';
import { CreateDeductionDto } from './dto/create-deduction.dto';

describe('CreateDeductionDto policy', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  const base = {
    companyId: 'company-1',
    employeeId: 'employee-1',
    amount: 100,
    transactionDate: '2026-08-09',
  };

  it('accepts ordinary manual deductions', async () => {
    await expect(
      pipe.transform(
        { ...base, deductionType: 'penalty' },
        { type: 'body', metatype: CreateDeductionDto },
      ),
    ).resolves.toMatchObject({ deductionType: 'penalty' });
  });

  it('rejects manual advance deductions because payroll owns settlement', async () => {
    await expect(
      pipe.transform(
        { ...base, deductionType: 'advance' },
        { type: 'body', metatype: CreateDeductionDto },
      ),
    ).rejects.toThrow();
  });
});

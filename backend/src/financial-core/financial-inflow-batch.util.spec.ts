import { BadRequestException } from '@nestjs/common';
import { assertValidInflowBatch } from './financial-inflow-batch.util';
import type { InflowDto } from './dto/financial-operation.dto';

function item(shift: 'morning' | 'evening' | 'all', partial?: Partial<InflowDto>): InflowDto {
  return {
    companyId: 'c1',
    transactionDate: '2026-05-10',
    customerCount: 10,
    channels: [{ vaultId: 'v1', amount: '100' }],
    shift,
    ...partial,
  };
}

describe('assertValidInflowBatch', () => {
  it('allows single morning', () => {
    expect(() => assertValidInflowBatch([item('morning')])).not.toThrow();
  });

  it('allows morning + evening', () => {
    expect(() => assertValidInflowBatch([item('morning'), item('evening')])).not.toThrow();
  });

  it('rejects all with another shift', () => {
    expect(() => assertValidInflowBatch([item('all'), item('morning')])).toThrow(BadRequestException);
  });

  it('rejects duplicate shifts', () => {
    expect(() => assertValidInflowBatch([item('morning'), item('morning')])).toThrow(BadRequestException);
  });

  it('rejects more than two items', () => {
    expect(() =>
      assertValidInflowBatch([item('morning'), item('evening'), item('morning')]),
    ).toThrow(BadRequestException);
  });
});

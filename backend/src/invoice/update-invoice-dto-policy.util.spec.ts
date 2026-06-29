import { ValidationPipe } from '@nestjs/common';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

describe('UpdateInvoiceDto policy', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  it('accepts invoice kind correction for the owner-only generic update route', async () => {
    await expect(
      pipe.transform(
        { kind: 'expense', totalAmount: 100 },
        { type: 'body', metatype: UpdateInvoiceDto },
      ),
    ).resolves.toMatchObject({ kind: 'expense', totalAmount: 100 });
  });

  it('rejects unknown invoice kinds', async () => {
    await expect(
      pipe.transform(
        { kind: 'not_a_kind', totalAmount: 100 },
        { type: 'body', metatype: UpdateInvoiceDto },
      ),
    ).rejects.toThrow();
  });

  it('accepts normal invoice amount updates without kind', async () => {
    await expect(
      pipe.transform(
        { totalAmount: 100, isTaxable: true },
        { type: 'body', metatype: UpdateInvoiceDto },
      ),
    ).resolves.toMatchObject({ totalAmount: 100, isTaxable: true });
  });
});

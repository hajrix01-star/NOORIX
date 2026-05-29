import { OcrInvoiceStatus } from './ocr-invoice-status';
import { listOcrChatReminders } from './ocr-chat-reminders.util';

describe('listOcrChatReminders', () => {
  it('maps failed invoices to reminder rows', async () => {
    const prisma = {
      ocrInvoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inv-1',
            extractionError: 'parse_error',
            submittedByUserId: 'u-1',
            createdAt: new Date('2026-05-01T10:00:00.000Z'),
            submittedBy: { nameAr: 'أحمد', email: 'a@test.com' },
          },
        ]),
      },
    };

    const rows = await listOcrChatReminders(prisma as never, 't-1', 'c-1', 5);

    expect(prisma.ocrInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 't-1',
          companyId: 'c-1',
          status: OcrInvoiceStatus.EXTRACTION_FAILED,
        }),
        take: 5,
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        invoiceId: 'inv-1',
        error: 'parse_error',
        submittedByName: 'أحمد',
      }),
    ]);
  });
});

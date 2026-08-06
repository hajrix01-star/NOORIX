import { describe, expect, it } from 'vitest';
import { buildReportsDetailPrintDocument } from './reportsDetailPrintModel';

const t = (key: string) => key;

describe('reports detail print model', () => {
  it('prints the reconciled ledger contribution instead of invoice gross fields', () => {
    const document = buildReportsDetailPrintDocument({
      data: {
        kind: 'invoices',
        detailSource: 'ledger',
        titleAr: 'رسوم حكومية',
        titleEn: 'Government fees',
        month: 7,
        monthLabel: 'Jul',
        items: [{
          id: 'entry-1',
          transactionDate: '2026-07-31',
          invoiceNumber: 'EXP-1',
          reportAmount: '400.0000',
          totalAmount: '1000',
          netAmount: '869.57',
          taxAmount: '130.43',
          percentOfSales: '4',
        }],
      },
      year: 2026,
      t,
      lang: 'ar',
      companyName: 'Company',
      companyLogoUrl: '',
    });

    expect(document.body).toContain('reportDocumentNumber');
    expect(document.body).toContain('reportLedgerContribution');
    expect(document.body).toContain('400');
    expect(document.body).not.toContain('869.57');
    expect(document.body).not.toContain('130.43');
  });
});

import { GENERAL_PNL_AMOUNT_BASIS, isGeneralPnlVatInclusive } from './reports-pl-contract.util';

describe('general P&L accounting contract', () => {
  it('declares the general P&L amount basis as VAT-inclusive gross', () => {
    expect(GENERAL_PNL_AMOUNT_BASIS).toBe('gross_including_vat');
    expect(isGeneralPnlVatInclusive(GENERAL_PNL_AMOUNT_BASIS)).toBe(true);
    expect(isGeneralPnlVatInclusive('net_excluding_vat')).toBe(false);
  });
});

export const GENERAL_PNL_AMOUNT_BASIS = 'gross_including_vat' as const;

export type GeneralPnlAmountBasis = typeof GENERAL_PNL_AMOUNT_BASIS;

export function isGeneralPnlVatInclusive(amountBasis: unknown): amountBasis is GeneralPnlAmountBasis {
  return amountBasis === GENERAL_PNL_AMOUNT_BASIS;
}

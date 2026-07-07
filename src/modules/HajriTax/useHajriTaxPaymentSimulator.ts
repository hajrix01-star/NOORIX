import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  normalizeDisclosureDecimals,
  scaleInputVatForPaymentTarget,
  syncVatPlanningSummaryFields,
  type TaxDisclosureData,
} from '../../constants/taxDisclosure';

type HajriTaxPaymentSimulatorParams = {
  paymentTargetStr: string;
  outputTotal: number;
  priorAdj: number;
  balanceCarried: number;
  detailVatRateDecimal: number;
  detailReadOnly: boolean;
  setDraftData: Dispatch<SetStateAction<TaxDisclosureData>>;
};

export function useHajriTaxPaymentSimulator({
  paymentTargetStr,
  outputTotal,
  priorAdj,
  balanceCarried,
  detailVatRateDecimal,
  detailReadOnly,
  setDraftData,
}: HajriTaxPaymentSimulatorParams) {
  const paymentTargetParsed = useMemo(() => {
    const parsed = parseFloat(String(paymentTargetStr).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [paymentTargetStr]);

  const simulatorRequiredInputVat = useMemo(() => {
    if (!Number.isFinite(paymentTargetParsed)) return null;
    return outputTotal + priorAdj + balanceCarried - paymentTargetParsed;
  }, [outputTotal, priorAdj, balanceCarried, paymentTargetParsed]);

  const simulatorEstimatedBaseAtStandardRate = useMemo(() => {
    if (simulatorRequiredInputVat == null || simulatorRequiredInputVat <= 0) return null;
    if (detailVatRateDecimal <= 0) return null;
    return +(simulatorRequiredInputVat / detailVatRateDecimal).toFixed(2);
  }, [simulatorRequiredInputVat, detailVatRateDecimal]);

  const simulatorInvalidTarget = useMemo(() => {
    if (!Number.isFinite(paymentTargetParsed)) return false;
    if (simulatorRequiredInputVat == null) return false;
    return simulatorRequiredInputVat < 0;
  }, [paymentTargetParsed, simulatorRequiredInputVat]);

  const handleBalancePayment = useCallback(() => {
    if (detailReadOnly) return;
    const target = parseFloat(String(paymentTargetStr).replace(/,/g, ''));
    if (!Number.isFinite(target)) return;
    setDraftData((prev) =>
      normalizeDisclosureDecimals(syncVatPlanningSummaryFields(
        scaleInputVatForPaymentTarget(prev, target, detailVatRateDecimal),
      )),
    );
  }, [paymentTargetStr, detailReadOnly, detailVatRateDecimal, setDraftData]);

  return {
    paymentTargetParsed,
    simulatorRequiredInputVat,
    simulatorEstimatedBaseAtStandardRate,
    simulatorInvalidTarget,
    handleBalancePayment,
  };
}

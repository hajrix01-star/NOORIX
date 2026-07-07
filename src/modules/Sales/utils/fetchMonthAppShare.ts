import { fetchAllSalesSummariesForExport } from '../../../services/api';
import type { DailySalesVaultRef } from '../components/DailySalesChannelsChips';
import {
  computeAppShareFromSummaries,
  monthRangeForYmd,
  type AppShareResult,
} from './salesAppShare';
import { toYmd } from '../../../utils/saudiDate';

/** نسبة التطبيقات لكل الأيام المسجلة في شهر تاريخ المعاملة */
export async function fetchMonthAppShare(
  companyId: string,
  transactionDate: string | null | undefined,
  vaultById?: Map<string, DailySalesVaultRef>,
): Promise<AppShareResult | undefined> {
  const range = monthRangeForYmd(toYmd(transactionDate));
  if (!companyId || !range) return undefined;
  try {
    const list = await fetchAllSalesSummariesForExport(
      companyId,
      range.start,
      range.end,
      undefined,
      'transactionDate',
      'asc',
      false,
      'any',
    );
    return computeAppShareFromSummaries(list, vaultById);
  } catch {
    return undefined;
  }
}

export type OwnerShishaInventorySourceSummary = Readonly<{
  current?: Readonly<{
    averageCostPerHead: number | null;
    charcoalPiecesTotal: number;
    hoses: number;
    tobaccoHeads: number;
    tobaccoKg: number;
  }>;
  daily?: readonly Readonly<{
    changes: number;
    closingCharcoalPieces: number;
    closingHoses: number;
    closingTobaccoHeads: number;
    closingTobaccoKg: number;
    date: string;
    newShisha: number;
    tobaccoConsumedKg: number;
    tobaccoHeadsConsumed: number;
    tobaccoPurchasedKg: number;
  }>[];
  effectiveStart?: string;
  endDate: string;
  initialized: boolean;
  periodTotals?: Readonly<{
    changes: number;
    newShisha: number;
    tobaccoConsumedKg: number;
    tobaccoHeadsConsumed: number;
    tobaccoPurchasedKg: number;
  }>;
  settings?: Readonly<{
    gramsPerHead: number;
    headsPerKg: number;
    trackingStartDate: string;
  }>;
  startDate: string;
}>;

export function buildOwnerAdminDashboardShishaSnapshot(
  summary: OwnerShishaInventorySourceSummary,
) {
  if (!summary.initialized) return { state: 'not-configured' as const };
  if (!summary.current || !summary.daily || !summary.periodTotals || !summary.settings) {
    throw new Error('SHISHA_INVENTORY_SUMMARY_INCOMPLETE');
  }

  const periodStartDate = summary.effectiveStart ?? summary.startDate;
  const daily = summary.daily
    .filter((row) => row.date >= periodStartDate && row.date <= summary.endDate)
    .map((row) => ({
      date: row.date,
      newShisha: row.newShisha,
      changes: row.changes,
      tobaccoHeadsConsumed: row.tobaccoHeadsConsumed,
      tobaccoConsumedKg: row.tobaccoConsumedKg,
      tobaccoPurchasedKg: row.tobaccoPurchasedKg,
      closingTobaccoKg: row.closingTobaccoKg,
      closingTobaccoHeads: row.closingTobaccoHeads,
      closingHoses: row.closingHoses,
      closingCharcoalPieces: row.closingCharcoalPieces,
    }));

  return {
    state: 'ready' as const,
    periodStartDate,
    periodEndDate: summary.endDate,
    settings: {
      trackingStartDate: summary.settings.trackingStartDate,
      headsPerKg: summary.settings.headsPerKg,
      gramsPerHead: summary.settings.gramsPerHead,
    },
    current: {
      tobaccoKg: summary.current.tobaccoKg,
      tobaccoHeads: summary.current.tobaccoHeads,
      hoses: summary.current.hoses,
      charcoalPieces: summary.current.charcoalPiecesTotal,
      averageCostPerHead: summary.current.averageCostPerHead,
    },
    periodTotals: {
      newShisha: summary.periodTotals.newShisha,
      changes: summary.periodTotals.changes,
      tobaccoHeadsConsumed: summary.periodTotals.tobaccoHeadsConsumed,
      tobaccoConsumedKg: summary.periodTotals.tobaccoConsumedKg,
      tobaccoPurchasedKg: summary.periodTotals.tobaccoPurchasedKg,
    },
    daily,
  };
}

import type { DailySalesChannelEntry } from './DailySalesChannelsChips';
import type { CreateSalesSummaryBody, DailySalesBatchPayload, SalesInputVaultRef, SalesMutationResult } from '../../../types/api/domains/sales';
import type { buildShiftEntryPayload } from './SalesShiftEntryCard';

export type SalesEntryTranslate = (key: string, ...args: string[]) => string;

export type SavedSummary = {
  id?: string;
  summaryNumber?: string | number | null;
  totalAmount?: string | number | null;
  customerCount?: number | null;
  shift?: string;
  transactionDate?: string | null;
  channels?: DailySalesChannelEntry[] | null;
};

export type SalesMutationResponse = {
  data?: SalesMutationResult;
  summary?: SavedSummary;
  summaries?: SavedSummary[];
};

export type SalesMutation<TVariables> = {
  mutate: (
    variables: TVariables,
    options?: {
      onSuccess?: (result: SalesMutationResponse) => void;
      onError?: (error: unknown) => void;
    },
  ) => void;
  isPending: boolean;
};

export type SalesEntryModalProps = {
  companyId: string;
  companyName?: string;
  salesChannels: SalesInputVaultRef[];
  salesChannelsLoading?: boolean;
  salesChannelsError?: string;
  vatEnabled?: boolean;
  vatRate?: number;
  createSummary: SalesMutation<CreateSalesSummaryBody>;
  createSummaryBatch?: SalesMutation<DailySalesBatchPayload>;
  onSuccess?: (summary: SavedSummary | SavedSummary[]) => void;
  onError?: (msg: string) => void;
  onClose?: () => void;
  onWhatsApp?: (summary: SavedSummary) => void;
  autoCloseOnSuccess?: boolean;
};

export type SalesEntryItem = ReturnType<typeof buildShiftEntryPayload>;

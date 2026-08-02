import type { OrdersV4DocumentType } from './orders-v4.contracts';
import { ordersV4RecentDateWindow } from './orders-v4-date.util';

export function resolveOrdersV4DocumentListScope({
  canReadAll,
  documentType,
  requestedStartDate,
  requestedEndDate,
  userId,
  todayYmd,
}: {
  canReadAll: boolean;
  documentType?: OrdersV4DocumentType;
  requestedStartDate?: string;
  requestedEndDate?: string;
  userId: string;
  todayYmd?: string;
}): { startDate?: string; endDate?: string; createdByUserId?: string } {
  if (canReadAll) {
    return { startDate: requestedStartDate, endDate: requestedEndDate };
  }
  if (documentType === 'registration') {
    const recent = ordersV4RecentDateWindow(todayYmd, 7);
    return { ...recent, createdByUserId: userId };
  }
  return {
    startDate: requestedStartDate,
    endDate: requestedEndDate,
    createdByUserId: userId,
  };
}

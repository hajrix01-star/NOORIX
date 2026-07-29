import {
  createShishaInventoryPurchase,
  createShishaInventoryPurchases,
  createShishaInventoryStocktake,
  getShishaInventorySummary,
  initializeShishaInventory,
} from '../../services/api';
import { orderKeys } from '../../services/queryKeys';
import type {
  CreateShishaPurchasePayload,
  CreateShishaPurchaseBatchPayload,
  CreateShishaStocktakePayload,
  InitializeShishaInventoryPayload,
  ShishaInventorySummary,
} from '../../types/api';
import { useApiMutation } from '../useApiMutation';
import { useApiQuery } from '../useApiQuery';

export function useShishaInventory(companyId: string, startDate: string, endDate: string) {
  return useApiQuery<ShishaInventorySummary>({
    queryKey: orderKeys.shishaInventory(companyId, startDate, endDate),
    queryFn: () => getShishaInventorySummary(companyId, startDate, endDate),
    fallbackMessage: 'Failed to load shisha inventory',
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

export function useInitializeShishaInventoryMutation() {
  return useApiMutation({
    mutationFn: (body: InitializeShishaInventoryPayload) => initializeShishaInventory(body),
    invalidateQueries: [orderKeys.shishaInventoryRoot()],
    successToast: 'تم تسجيل مخزون البداية بنجاح',
  });
}

export function useCreateShishaPurchaseMutation() {
  return useApiMutation({
    mutationFn: (body: CreateShishaPurchasePayload) => createShishaInventoryPurchase(body),
    invalidateQueries: [orderKeys.shishaInventoryRoot()],
    successToast: 'تم تسجيل حركة الشراء بنجاح',
  });
}

export function useCreateShishaPurchasesMutation() {
  return useApiMutation({
    mutationFn: (body: CreateShishaPurchaseBatchPayload) => createShishaInventoryPurchases(body),
    invalidateQueries: [orderKeys.shishaInventoryRoot()],
    successToast: 'تم تسجيل فاتورة الشراء بجميع أصنافها بنجاح',
  });
}

export function useCreateShishaStocktakeMutation() {
  return useApiMutation({
    mutationFn: (body: CreateShishaStocktakePayload) => createShishaInventoryStocktake(body),
    invalidateQueries: [orderKeys.shishaInventoryRoot()],
    successToast: 'تم اعتماد الجرد وتسجيل فروقات التصحيح',
  });
}

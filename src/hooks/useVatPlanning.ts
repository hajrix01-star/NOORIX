import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getVatPlanningList, getVatPlanningRegistry, upsertVatPlanning, throwIfApiFailed } from '../services/api';
import { vatKeys } from '../services/queryKeys';

export function useVatPlanningList(year: any, quarter: any, companyId: any, enabled: any = true) {
  return useQuery({
    queryKey: vatKeys.planning(year, quarter, companyId ?? ''),
    queryFn: async () => {
      const res = await getVatPlanningList(year, quarter, companyId);
      throwIfApiFailed(res, 'فشل تحميل سجل الضريبة التخطيطي');
      const raw = res.data;
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!enabled && Number.isFinite(year) && Number.isFinite(quarter),
  });
}

/** قائمة الإقرارات المسجّلة (فلاتر اختيارية) */
export function useVatPlanningRegistry(filters: any, enabled: any = true) {
  return useQuery({
    queryKey: vatKeys.registry(
      String(filters?.year ?? ''),
      String(filters?.quarter ?? ''),
      String(filters?.companyId ?? ''),
    ),
    queryFn: async () => {
      const res = await getVatPlanningRegistry(filters);
      throwIfApiFailed(res, 'فشل تحميل سجل الإقرارات');
      const raw = res.data;
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!enabled,
  });
}

export function useUpsertVatPlanning() {
  const qc = useQueryClient();
  return useMutation<any, Error, Record<string, unknown>>({
    mutationFn: async (body: any) => {
      const res = await upsertVatPlanning(body);
      throwIfApiFailed(res, 'فشل حفظ السجل الضريبي');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vatKeys.root() });
    },
  });
}

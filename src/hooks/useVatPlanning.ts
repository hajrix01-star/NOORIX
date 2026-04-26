import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getVatPlanningList, getVatPlanningRegistry, upsertVatPlanning, throwIfApiFailed } from '../services/api';

export function useVatPlanningList(year, quarter, companyId, enabled = true) {
  return useQuery({
    queryKey: ['vat-planning', year, quarter, companyId ?? ''],
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
export function useVatPlanningRegistry(filters, enabled = true) {
  return useQuery({
    queryKey: ['vat-planning', 'registry', filters?.year ?? '', filters?.quarter ?? '', filters?.companyId ?? ''],
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
    mutationFn: async (body) => {
      const res = await upsertVatPlanning(body);
      throwIfApiFailed(res, 'فشل حفظ السجل الضريبي');
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat-planning'] });
    },
  });
}

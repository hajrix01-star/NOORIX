import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getVatPlanningList, upsertVatPlanning, throwIfApiFailed } from '../services/api';

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

export function useUpsertVatPlanning() {
  const qc = useQueryClient();
  return useMutation({
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

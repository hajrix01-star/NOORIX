import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getEmployees, getExpenseLines, getVaults } from '../../../services/api';
import { employeeKeys, expenseKeys, vaultKeys } from '../../../services/queryKeys';
import type { ExpenseMode } from '../types';

/**
 * استعلامات وتحميل مسبق مرتبطة ببنود المصروف وطلبات HR/الخزينة — نفس الاستدعاءات السابقة.
 */
export function useSmartChatUploads(
  activeCompanyId: string | undefined,
  expenseMode: ExpenseMode,
) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!activeCompanyId) return;
    qc.prefetchQuery({
      queryKey: employeeKeys.list(activeCompanyId, false),
      queryFn: async () => {
        const res = await getEmployees(activeCompanyId, false);
        return res?.success ? (res.data ?? []) : [];
      },
    });
    qc.prefetchQuery({
      queryKey: vaultKeys.shortActive(activeCompanyId),
      queryFn: async () => {
        const res = await getVaults(activeCompanyId, false);
        if (!res?.success) return [];
        const d = res.data;
        return Array.isArray(d) ? d : (d?.items ?? []);
      },
    });
  }, [activeCompanyId, qc]);

  const { data: expenseLines = [] } = useQuery({
    queryKey: expenseKeys.lines(activeCompanyId || ''),
    queryFn: async () => {
      const res = await getExpenseLines(activeCompanyId || '');
      return res?.data ?? (Array.isArray(res) ? res : []);
    },
    enabled: !!activeCompanyId && (expenseMode === 'editLine' || expenseMode === 'addLine' || expenseMode === 'pay'),
  });

  return { expenseLines };
}

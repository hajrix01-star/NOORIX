import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getEmployees, getExpenseLines, getVaults, unwrapApiList } from '../../../services/api';
import { useApiListQuery } from '../../../hooks/useApiQuery';
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
        return unwrapApiList(res, 'فشل تحميل الموظفين');
      },
    });
    qc.prefetchQuery({
      queryKey: vaultKeys.shortActive(activeCompanyId),
      queryFn: async () => {
        const res = await getVaults(activeCompanyId, false);
        return unwrapApiList(res, 'فشل تحميل الخزائن');
      },
    });
  }, [activeCompanyId, qc]);

  const { data: expenseLines = [] } = useApiListQuery<any>({
    queryKey: expenseKeys.lines(activeCompanyId || ''),
    queryFn: () => getExpenseLines(activeCompanyId || ''),
    fallbackMessage: 'فشل تحميل بنود المصاريف',
    enabled: !!activeCompanyId && (expenseMode === 'editLine' || expenseMode === 'addLine' || expenseMode === 'pay'),
  });

  return { expenseLines };
}

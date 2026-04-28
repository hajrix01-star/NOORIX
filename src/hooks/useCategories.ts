/**
 * useCategories — جلب التصنيفات (شجرة أم/فرعية) مع CRUD كامل.
 * يُعيد أيضاً قائمة مسطّحة (flatCategories) لاستخدامها في الـ selects.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from './useApiMutation';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../services/api';
import { categoryKeys } from '../services/queryKeys';

export function useCategories(companyId: string | null | undefined) {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: categoryKeys.list(companyId || ''),
    queryFn: async () => {
      const res = await getCategories(companyId as string);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId,
  });

  const flatCategories = useMemo(() => {
    const list: unknown[] = [];
    for (const cat of categories as { children?: unknown[] }[]) {
      list.push(cat);
      for (const child of cat.children || []) list.push(child);
    }
    return list;
  }, [categories]);

  const createMutation = useApiMutation({
    mutationFn: createCategory,
    invalidateQueries: [categoryKeys.list(companyId as string)],
    showErrorToast: false,
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => updateCategory(id, body),
    invalidateQueries: [categoryKeys.list(companyId as string)],
    showErrorToast: false,
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) => deleteCategory(id, companyId as string),
    invalidateQueries: [categoryKeys.list(companyId as string)],
    showErrorToast: false,
  });

  return {
    categories,
    flatCategories,
    isLoading,
    create: createMutation,
    update: updateMutation,
    remove: deleteMutation,
  };
}

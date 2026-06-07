/**
 * useCategories — جلب التصنيفات (شجرة أم/فرعية) مع CRUD كامل.
 * يُعيد أيضاً قائمة مسطّحة (flatCategories) لاستخدامها في الـ selects.
 */
import { useMemo } from 'react';
import { useApiMutation } from './useApiMutation';
import { useApiListQuery } from './useApiQuery';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../services/api';
import { categoryKeys } from '../services/queryKeys';

type CategoryNode = {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
  children?: CategoryNode[];
  [key: string]: unknown;
};

export function useCategories(companyId: string | null | undefined) {
  const { data: categories = [], isLoading } = useApiListQuery<CategoryNode>({
    queryKey: categoryKeys.list(companyId || ''),
    queryFn: () => getCategories(companyId as string),
    fallbackMessage: 'فشل تحميل التصنيفات',
    enabled: !!companyId,
  });

  const flatCategories = useMemo(() => {
    const list: unknown[] = [];
    for (const cat of categories) {
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

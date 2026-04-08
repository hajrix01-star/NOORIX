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

/**
 * @param {string} companyId
 */
export function useCategories(companyId) {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', companyId],
    queryFn: async () => {
      const res = await getCategories(companyId);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId,
  });

  // قائمة مسطّحة: كل الفئات الأم + الفرعية في مصفوفة واحدة
  const flatCategories = useMemo(() => {
    const list = [];
    for (const cat of categories) {
      list.push(cat);
      for (const child of cat.children || []) list.push(child);
    }
    return list;
  }, [categories]);

  const createMutation = useApiMutation({
    mutationFn: createCategory,
    invalidateQueries: [['categories', companyId]],
    showErrorToast: false,
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }) => updateCategory(id, body),
    invalidateQueries: [['categories', companyId]],
    showErrorToast: false,
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id) => deleteCategory(id, companyId),
    invalidateQueries: [['categories', companyId]],
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

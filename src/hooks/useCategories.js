/**
 * useCategories — جلب التصنيفات (شجرة أم/فرعية) مع CRUD كامل.
 * يُعيد أيضاً قائمة مسطّحة (flatCategories) لاستخدامها في الـ selects.
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

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

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['categories', companyId] });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateCategory(id, body),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteCategory(id, companyId),
    onSuccess: invalidate,
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

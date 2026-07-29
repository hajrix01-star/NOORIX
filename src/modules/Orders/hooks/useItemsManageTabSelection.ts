import { useState } from 'react';

type TranslateFn = (key: string, vars?: unknown) => string;

type DeleteMutation = {
  mutate: (
    ids: string[],
    options: {
      onSuccess: (result: { data?: { deleted?: number } }) => void;
      onError: (error: Error) => void;
    },
  ) => void;
};

export function useItemsManageTabSelection({
  t,
  showToast,
  deleteProductsMutation,
  deleteCategoriesMutation,
}: {
  t: TranslateFn;
  showToast: (message: string, type?: 'success' | 'error') => void;
  deleteProductsMutation: DeleteMutation;
  deleteCategoriesMutation: DeleteMutation;
}) {
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

  function toggleProductSelection(id: string) {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllProducts(ids: string[]) {
    setSelectedProductIds((prev) =>
      prev.size === ids.length ? new Set() : new Set(ids),
    );
  }

  function toggleCategorySelection(id: string) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllCategories(ids: string[]) {
    setSelectedCategoryIds((prev) =>
      prev.size === ids.length ? new Set() : new Set(ids),
    );
  }

  function handleDeleteSelectedProducts() {
    const ids = [...selectedProductIds];
    if (!ids.length) return;
    deleteProductsMutation.mutate(ids, {
      onSuccess: (result) => {
        const count = result?.data?.deleted ?? ids.length;
        showToast(t('ordersProductsDeleted', String(count)), 'success');
        setSelectedProductIds(new Set());
      },
      onError: (error) => showToast(error?.message || t('deleteFailed'), 'error'),
    });
  }

  function handleDeleteSelectedCategories() {
    const ids = [...selectedCategoryIds];
    if (!ids.length) return;
    deleteCategoriesMutation.mutate(ids, {
      onSuccess: (result) => {
        const count = result?.data?.deleted ?? ids.length;
        showToast(t('ordersCategoriesDeleted', String(count)), 'success');
        setSelectedCategoryIds(new Set());
      },
      onError: (error) => showToast(error?.message || t('deleteFailed'), 'error'),
    });
  }

  return {
    selectedProductIds,
    selectedCategoryIds,
    toggleProductSelection,
    toggleAllProducts,
    toggleCategorySelection,
    toggleAllCategories,
    handleDeleteSelectedProducts,
    handleDeleteSelectedCategories,
  };
}

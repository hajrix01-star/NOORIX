import React, { useEffect, useMemo, useState } from 'react';
import {
  useApplyOrderCategoryTranslationsMutation,
  usePreviewOrderCategoryTranslationsMutation,
} from '../../../../hooks/orders/orderCatalogHooks';
import { useToast } from '../../../../context/ToastContext';
import { Button, Checkbox, Input, Modal } from '../../../../ui';
import type { OrderCategoryTranslationSuggestion } from '../../../../types/api';

type CategoryTranslationModalProps = {
  open: boolean;
  onClose: () => void;
  companyId: string;
};

type CategoryTranslationDraft = OrderCategoryTranslationSuggestion & {
  nameEn: string;
  selected: boolean;
};

export function CategoryTranslationModal({ open, onClose, companyId }: CategoryTranslationModalProps) {
  const { showToast } = useToast();
  const previewMutation = usePreviewOrderCategoryTranslationsMutation(companyId);
  const applyMutation = useApplyOrderCategoryTranslationsMutation(companyId);
  const preview = previewMutation.mutateAsync;
  const [rows, setRows] = useState<CategoryTranslationDraft[]>([]);
  const [totalMissing, setTotalMissing] = useState(0);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!open) return;
    let active = true;
    setRows([]);
    setTotalMissing(0);
    setLoadError('');
    preview()
      .then((result) => {
        if (!active) return;
        const suggestions = result.data?.suggestions ?? [];
        setRows(suggestions.map((suggestion) => ({
          ...suggestion,
          nameEn: suggestion.suggestedNameEn,
          selected: !suggestion.needsReview && Boolean(suggestion.suggestedNameEn.trim()),
        })));
        setTotalMissing(result.data?.totalMissing ?? suggestions.length);
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message || 'تعذر إنشاء اقتراحات ترجمة الفئات.');
      });
    return () => { active = false; };
  }, [open, preview]);

  const selectedRows = useMemo(
    () => rows.filter((row) => row.selected && row.nameEn.trim()),
    [rows],
  );

  function updateRow(categoryId: string, patch: Partial<Pick<CategoryTranslationDraft, 'nameEn' | 'selected'>>) {
    setRows((current) => current.map((row) => (
      row.categoryId === categoryId ? { ...row, ...patch } : row
    )));
  }

  async function applySelected() {
    const result = await applyMutation.mutateAsync(selectedRows.map((row) => ({
      categoryId: row.categoryId,
      nameEn: row.nameEn.trim(),
    })));
    showToast(`تم اعتماد ${result.data?.updatedCount ?? 0} ترجمة للفئات.`, 'success');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="مراجعة ترجمة الفئات"
      size="lg"
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
          <Button
            variant="primary"
            size="sm"
            loading={applyMutation.isPending}
            disabled={selectedRows.length === 0}
            onClick={applySelected}
          >
            اعتماد المحدد ({selectedRows.length})
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-3" dir="rtl">
        <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-4 py-3 text-[13px] text-noorix-muted">
          تُعرض اقتراحات الفئات الناقصة فقط، ولن تُستبدل ترجمة محفوظة. {rows.length} من {totalMissing} فئة.
        </div>
        {previewMutation.isPending && <div className="py-10 text-center text-noorix-muted">جارٍ إعداد الاقتراحات...</div>}
        {!previewMutation.isPending && loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-noorix-red">{loadError}</div>
        )}
        {!previewMutation.isPending && !loadError && rows.length === 0 && (
          <div className="py-10 text-center text-noorix-muted">لا توجد فئات ناقصة الترجمة.</div>
        )}
        {rows.map((row) => (
          <div key={row.categoryId} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-noorix-border p-3 md:grid-cols-[auto_minmax(160px,0.8fr)_minmax(220px,1.2fr)_auto]">
            <Checkbox
              checked={row.selected}
              disabled={!row.nameEn.trim()}
              onChange={(event) => updateRow(row.categoryId, { selected: event.target.checked })}
              aria-label={`اختيار ${row.nameAr}`}
            />
            <strong className="text-[14px]">{row.nameAr}</strong>
            <Input
              value={row.nameEn}
              dir="ltr"
              className="text-left"
              containerClassName="col-span-2 md:col-span-1"
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const nameEn = event.target.value;
                updateRow(row.categoryId, { nameEn, selected: row.selected && Boolean(nameEn.trim()) });
              }}
            />
            <span className={`col-span-2 rounded-full px-2 py-1 text-center text-[11px] font-bold md:col-span-1 ${row.needsReview ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'}`}>
              ثقة {Math.round(row.confidence * 100)}%
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

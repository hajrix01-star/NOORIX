import React, { useEffect, useMemo, useState } from 'react';
import {
  useApplyOrderProductTranslationsMutation,
  usePreviewOrderProductTranslationsMutation,
} from '../../../../hooks/orders/orderCatalogHooks';
import { useToast } from '../../../../context/ToastContext';
import { Button, Checkbox, Input, Modal } from '../../../../ui';
import type {
  CatalogTranslationClassification,
  OrderProductTranslationSuggestion,
  OrderProductType,
} from '../../../../types/api';

type CatalogTranslationModalProps = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  productType: OrderProductType;
};

type TranslationDraft = OrderProductTranslationSuggestion & {
  nameEn: string;
  selected: boolean;
};

const CLASSIFICATION_LABELS: Record<CatalogTranslationClassification, string> = {
  ingredient: 'مكون غذائي',
  beverage: 'مشروب',
  cleaning: 'نظافة',
  packaging: 'تغليف',
  equipment: 'معدات',
  brand: 'علامة تجارية',
  other: 'أخرى',
};

function toDraft(suggestion: OrderProductTranslationSuggestion): TranslationDraft {
  return {
    ...suggestion,
    nameEn: suggestion.suggestedNameEn,
    selected: !suggestion.needsReview && Boolean(suggestion.suggestedNameEn.trim()),
  };
}

export function CatalogTranslationModal({
  open,
  onClose,
  companyId,
  productType,
}: CatalogTranslationModalProps) {
  const { showToast } = useToast();
  const previewMutation = usePreviewOrderProductTranslationsMutation(companyId);
  const applyMutation = useApplyOrderProductTranslationsMutation(companyId);
  const previewTranslations = previewMutation.mutateAsync;
  const [rows, setRows] = useState<TranslationDraft[]>([]);
  const [totalMissing, setTotalMissing] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!open) return;

    let active = true;
    setRows([]);
    setTotalMissing(0);
    setTruncated(false);
    setLoadError('');

    previewTranslations(productType)
      .then((result) => {
        if (!active) return;
        const suggestions = result.data?.suggestions ?? [];
        setRows(suggestions.map(toDraft));
        setTotalMissing(result.data?.totalMissing ?? suggestions.length);
        setTruncated(Boolean(result.data?.truncated));
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message || 'تعذر إنشاء اقتراحات الترجمة.');
      });

    return () => {
      active = false;
    };
  }, [open, previewTranslations, productType]);

  const selectedRows = useMemo(
    () => rows.filter((row) => row.selected && Boolean(row.nameEn.trim())),
    [rows],
  );
  const allSelectableChecked = rows.length > 0
    && rows.every((row) => !row.nameEn.trim() || row.selected);

  function updateRow(productId: string, changes: Partial<Pick<TranslationDraft, 'nameEn' | 'selected'>>) {
    setRows((current) => current.map((row) => (
      row.productId === productId ? { ...row, ...changes } : row
    )));
  }

  async function applySelectedTranslations() {
    const result = await applyMutation.mutateAsync(
      selectedRows.map((row) => ({ productId: row.productId, nameEn: row.nameEn.trim() })),
    );
    const updatedCount = result.data?.updatedCount ?? 0;
    const skippedCount = result.data?.skippedCount ?? 0;
    showToast(
      skippedCount > 0
        ? `تم اعتماد ${updatedCount} ترجمة وتجاوز ${skippedCount} صنفاً لم يعد مؤهلاً.`
        : `تم اعتماد ${updatedCount} ترجمة.`,
      'success',
    );
    onClose();
  }

  const footer = (
    <>
      <Button variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
      <Button
        variant="primary"
        size="sm"
        loading={applyMutation.isPending}
        disabled={selectedRows.length === 0}
        onClick={applySelectedTranslations}
      >
        اعتماد المحدد ({selectedRows.length})
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="مراجعة ترجمة أسماء الأصناف"
      size="xl"
      footer={footer}
    >
      <div className="flex flex-col gap-4" dir="rtl">
        <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="m-0 text-[14px] font-bold text-noorix-text">
                اقتراحات سياقية للمطاعم
              </p>
              <p className="mt-1 mb-0 text-[12px] text-noorix-muted">
                راجع الاسم الإنجليزي قبل اعتماده. لن يتم استبدال أي ترجمة محفوظة مسبقاً.
              </p>
            </div>
            {!previewMutation.isPending && !loadError && (
              <span className="text-[12px] font-semibold text-noorix-muted">
                {rows.length} من {totalMissing} صنف
              </span>
            )}
          </div>
          {truncated && (
            <p className="mt-2 mb-0 text-[12px] text-noorix-warning">
              عُرضت أول {rows.length} نتيجة. اعتمدها ثم افتح النافذة مجدداً لإكمال البقية.
            </p>
          )}
        </div>

        {previewMutation.isPending && (
          <div className="min-h-36 flex items-center justify-center text-[13px] text-noorix-muted">
            جارٍ فهم الأصناف وإنشاء الاقتراحات...
          </div>
        )}

        {!previewMutation.isPending && loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-[13px] text-noorix-red">
            {loadError}
          </div>
        )}

        {!previewMutation.isPending && !loadError && rows.length === 0 && (
          <div className="min-h-36 flex items-center justify-center rounded-lg border border-noorix-border text-[13px] text-noorix-muted">
            لا توجد أسماء ناقصة الترجمة في هذا القسم.
          </div>
        )}

        {!previewMutation.isPending && !loadError && rows.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <Checkbox
                checked={allSelectableChecked}
                onChange={(event) => {
                  const selected = event.target.checked;
                  setRows((current) => current.map((row) => ({
                    ...row,
                    selected: selected && Boolean(row.nameEn.trim()),
                  })));
                }}
                label="تحديد كل الاقتراحات"
                containerClassName="font-semibold"
              />
              <span className="text-[12px] text-noorix-muted">
                الاقتراحات منخفضة الثقة غير محددة تلقائياً
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <div
                  key={row.productId}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-noorix-border bg-white p-3 md:grid-cols-[auto_minmax(150px,0.8fr)_minmax(220px,1.2fr)_auto] md:items-center"
                >
                  <Checkbox
                    checked={row.selected}
                    disabled={!row.nameEn.trim()}
                    onChange={(event) => updateRow(row.productId, { selected: event.target.checked })}
                    aria-label={`اختيار ${row.nameAr}`}
                  />

                  <div className="min-w-0">
                    <p className="m-0 truncate text-[14px] font-bold text-noorix-text">{row.nameAr}</p>
                    <p className="mt-1 mb-0 truncate text-[12px] text-noorix-muted">
                      {[row.categoryAr, row.unit].filter(Boolean).join(' · ') || 'بدون تصنيف'}
                    </p>
                  </div>

                  <Input
                    value={row.nameEn}
                    dir="ltr"
                    aria-label={`الاسم الإنجليزي لـ ${row.nameAr}`}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      const nameEn = event.target.value;
                      updateRow(row.productId, {
                        nameEn,
                        selected: row.selected && Boolean(nameEn.trim()),
                      });
                    }}
                    className="text-left"
                    containerClassName="col-span-2 md:col-span-1"
                  />

                  <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1 md:justify-end">
                    <span className="rounded-full bg-noorix-bg-muted px-2 py-1 text-[11px] font-semibold text-noorix-muted">
                      {CLASSIFICATION_LABELS[row.classification]}
                    </span>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                      row.needsReview
                        ? 'bg-orange-50 text-orange-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      ثقة {Math.round(row.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

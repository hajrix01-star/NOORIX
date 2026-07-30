import React, { useMemo, useCallback } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Button, Checkbox, SmartTable, Badge } from '../../../../ui';
import {
  parseProductDisplayNames,
  productVariantsSummary,
  productPriceLineShort,
} from './catalogProductUtils';
import type { OrderProduct } from '../../../../types/api';

type CatalogProductTableProps = {
  rows: OrderProduct[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onEdit: (row: OrderProduct) => void;
  isLoading?: boolean;
};

export function CatalogProductTable({
  rows,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onEdit,
  isLoading,
}: CatalogProductTableProps) {
  const { t } = useTranslation();
  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = allIds.length > 0 && selectedIds.size === allIds.length;

  const renderMobileCard = useCallback((row: OrderProduct) => {
    const secs = Array.isArray(row.sections) && row.sections.length > 0 ? row.sections : [];
    const priceFull = productVariantsSummary(row);
    const priceShort = productPriceLineShort(row);
    const categoryLabel = row.category?.nameAr || row.category?.nameEn || null;
    const { nameAr, nameEn, brand } = parseProductDisplayNames(row);
    return (
      <div className="flex flex-col gap-2.5 min-w-0 max-w-full">
        <div className="flex items-start gap-2 min-w-0">
          <Checkbox
            checked={selectedIds.has(row.id)}
            onChange={() => onToggleSelect(row.id)}
            className="cursor-pointer shrink-0 mt-1"
            aria-label={nameAr || t('ordersSelectAll')}
          />
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <Button
              type="button"
              variant="raw"
              size="auto"
              className="w-fit max-w-full text-start font-bold text-[14px] leading-snug text-noorix-blue break-words hover:underline"
              onClick={() => onEdit(row)}
            >
              {nameAr}
            </Button>
            {nameEn ? (
              <div className="text-[12px] leading-snug text-noorix-muted break-words ltr text-start">
                {nameEn}
              </div>
            ) : null}
            {brand ? (
              <div className="text-[11px] leading-snug text-noorix-muted break-words">
                {brand}
              </div>
            ) : null}
            {categoryLabel ? (
              <div className="text-[11px] leading-snug text-noorix-muted/90 break-words">
                {categoryLabel}
              </div>
            ) : null}
          </div>
          {secs.length > 0 ? (
            <div className="flex flex-col items-end gap-1 shrink-0 max-w-[38%]">
              {secs.slice(0, 2).map((s: string) => (
                <Badge key={s} color="blue" size="sm" title={s}>
                  {s}
                </Badge>
              ))}
              {secs.length > 2 ? (
                <span className="text-[11px] text-noorix-muted">+{secs.length - 2}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {secs.length > 2 && (
          <div className="flex flex-wrap gap-1 ps-7">
            {secs.slice(2).map((s: string) => (
              <Badge key={s} color="blue" size="sm" title={s}>
                {s}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 min-w-0 ps-7">
          <span
            className="text-[13px] font-bold nx-font-numbers ltr min-w-0 flex-1 break-all text-noorix-text"
            title={priceFull}
          >
            {priceShort}
          </span>
        </div>
      </div>
    );
  }, [selectedIds, onToggleSelect, onEdit, t]);

  const columns = useMemo(() => [
    {
      key: '_sel',
      label: (
        <Checkbox
          checked={allSelected}
          onChange={() => onToggleAll(allIds)}
          className="cursor-pointer"
          aria-label={t('ordersSelectAll')}
        />
      ),
      width: 44,
      render: (_: unknown, row: OrderProduct) => (
        <Checkbox
          checked={selectedIds.has(row.id)}
          onChange={() => onToggleSelect(row.id)}
          className="cursor-pointer"
          aria-label={t('select')}
        />
      ),
    },
    {
      key: 'nameAr',
      label: t('productNameAr'),
      render: (_: unknown, row: OrderProduct) => (
        <Button
          type="button"
          variant="raw"
          size="auto"
          className="font-semibold text-[13px] truncate block max-w-[200px] text-noorix-blue hover:underline"
          title={row.nameAr}
          onClick={() => onEdit(row)}
        >
          {row.nameAr || '—'}
        </Button>
      ),
    },
    {
      key: 'nameEn',
      label: t('productNameEn'),
      render: (_: unknown, row: OrderProduct) => (
        <span className="text-noorix-muted text-[12px] truncate block max-w-[160px]" title={row.nameEn || undefined}>{row.nameEn || '—'}</span>
      ),
    },
    {
      key: 'category',
      label: t('category'),
      render: (_: unknown, row: OrderProduct) => row.category?.nameAr || row.category?.nameEn || '—',
    },
    {
      key: 'sections',
      label: t('productSections'),
      render: (_: unknown, row: OrderProduct) => {
        const secs = Array.isArray(row.sections) ? row.sections : [];
        if (!secs.length) return <span className="text-noorix-muted">—</span>;
        return (
          <span className="text-[12px] truncate block max-w-[140px]" title={secs.join(' · ')}>
            {secs.join(' · ')}
          </span>
        );
      },
    },
    {
      key: 'price',
      label: t('ordersVariantPrice'),
      numeric: true,
      render: (_: unknown, row: OrderProduct) => (
        <span className="nx-font-numbers ltr text-noorix-text" title={productVariantsSummary(row)}>
          {productVariantsSummary(row)}
        </span>
      ),
    },
  ], [allSelected, allIds, selectedIds, onToggleSelect, onToggleAll, onEdit, t]);

  return (
    <SmartTable
      tableId="orders-catalog-products"
      columns={columns}
      data={rows}
      total={rows.length}
      isLoading={isLoading}
      showSearchInHeader={false}
      emptyMessage={t('ordersNoProductsYet')}
      renderMobileCard={renderMobileCard}
      stripeMobileCards
      tableMinWidth={900}
      getRowClassName={(row) => (selectedIds.has(row.id) ? 'bg-noorix-bg-muted/60' : undefined)}
    />
  );
}

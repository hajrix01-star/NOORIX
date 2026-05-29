import React, { useMemo, useCallback } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { SmartTable, KebabMenu, Badge } from '../../../../ui';
import { productVariantsSummary, productPriceLineShort } from './catalogProductUtils';

type CatalogProductTableProps = {
  rows: any[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onEdit: (row: any) => void;
  onDeactivate: (row: any) => void;
  isLoading?: boolean;
};

export function CatalogProductTable({
  rows,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onEdit,
  onDeactivate,
  isLoading,
}: CatalogProductTableProps) {
  const { t } = useTranslation();
  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = allIds.length > 0 && selectedIds.size === allIds.length;

  const renderMobileCard = useCallback((row: any) => {
    const secs = Array.isArray(row.sections) && row.sections.length > 0 ? row.sections : [];
    const priceFull = productVariantsSummary(row);
    const priceShort = productPriceLineShort(row);
    const categoryLabel = row.category?.nameAr || row.category?.nameEn || '—';
    return (
      <div className="flex flex-col gap-2 min-w-0 max-w-full overflow-hidden">
        <div className="nx-mc__header min-w-0">
          <div className="nx-mc__meta min-w-0 flex-1">
            <div className="nx-mc__name truncate" title={row.nameAr}>{row.nameAr || '—'}</div>
            {row.nameEn && (
              <div className="nx-mc__subtitle truncate" title={row.nameEn}>{row.nameEn}</div>
            )}
            <div className="text-[12px] text-noorix-muted truncate mt-0.5" title={categoryLabel}>
              {categoryLabel}
            </div>
          </div>
          <input
            type="checkbox"
            checked={selectedIds.has(row.id)}
            onChange={() => onToggleSelect(row.id)}
            className="cursor-pointer shrink-0 mt-1"
            aria-label={row.nameAr || t('ordersSelectAll')}
          />
        </div>
        {secs.length > 0 && (
          <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
            {secs.map((s: string) => (
              <Badge key={s} color="blue" size="sm" className="max-w-full truncate" title={s}>
                {s}
              </Badge>
            ))}
          </div>
        )}
        <div className="nx-mc__actions min-w-0">
          <span
            className="text-[13px] font-bold nx-font-numbers ltr min-w-0 flex-1 truncate pe-2"
            title={priceFull}
          >
            {priceShort}
          </span>
          <KebabMenu
            ariaLabel={t('actions')}
            items={[
              { key: 'edit', label: t('edit'), onClick: () => onEdit(row), style: { color: 'var(--noorix-accent-green)' } },
              { key: 'del', label: t('delete'), onClick: () => onDeactivate(row), style: { color: 'var(--noorix-accent-red)' } },
            ]}
          />
        </div>
      </div>
    );
  }, [selectedIds, onToggleSelect, onEdit, onDeactivate, t]);

  const columns = useMemo(() => [
    {
      key: '_sel',
      label: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => onToggleAll(allIds)}
          className="cursor-pointer"
          aria-label={t('ordersSelectAll')}
        />
      ),
      width: 44,
      render: (_: unknown, row: any) => (
        <input
          type="checkbox"
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
      render: (_: unknown, row: any) => (
        <span className="font-semibold text-[13px] truncate block max-w-[200px]" title={row.nameAr}>{row.nameAr || '—'}</span>
      ),
    },
    {
      key: 'nameEn',
      label: t('productNameEn'),
      render: (_: unknown, row: any) => (
        <span className="text-noorix-muted text-[12px] truncate block max-w-[160px]" title={row.nameEn}>{row.nameEn || '—'}</span>
      ),
    },
    {
      key: 'category',
      label: t('category'),
      render: (_: unknown, row: any) => row.category?.nameAr || row.category?.nameEn || '—',
    },
    {
      key: 'sections',
      label: t('productSections'),
      render: (_: unknown, row: any) => {
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
      render: (_: unknown, row: any) => (
        <span className="nx-font-numbers ltr">{productVariantsSummary(row)}</span>
      ),
    },
    {
      key: 'actions',
      label: t('actions'),
      align: 'center',
      render: (_: unknown, row: any) => (
        <KebabMenu
          ariaLabel={t('actions')}
          items={[
            { key: 'edit', label: t('edit'), onClick: () => onEdit(row), style: { color: 'var(--noorix-accent-green)' } },
            { key: 'del', label: t('delete'), onClick: () => onDeactivate(row), style: { color: 'var(--noorix-accent-red)' } },
          ]}
        />
      ),
    },
  ], [allSelected, allIds, selectedIds, onToggleSelect, onToggleAll, onEdit, onDeactivate, t]);

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

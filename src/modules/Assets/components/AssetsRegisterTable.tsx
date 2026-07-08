import React, { useCallback, useMemo } from 'react';
import { SmartTable, Badge, KebabMenu, type SmartTableColumn } from '../../../ui';
import { formatMoney } from '../../../utils/money';
import type { AssetRegisterListItem } from '../types';
import { formatAssetDate, getSupplierDisplayName } from '../utils/assetsRegisterMappers';
import { useWarrantyBadgeMap } from '../utils/assetsRegisterCalculations';
import { normalizeWarrantyStatus } from '../assetsRegisterModel';

export type AssetsRegisterTableProps = {
  items: AssetRegisterListItem[];
  total: number;
  sumAll: string;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  t: (k: string) => string;
  lang: string;
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (row: AssetRegisterListItem) => void;
  onDelete: (row: AssetRegisterListItem) => void;
};

export function AssetsRegisterTable({
  items,
  total,
  sumAll,
  page,
  pageSize,
  onPageChange,
  isLoading,
  isError,
  errorMessage,
  t,
  lang,
  canWrite,
  canDelete,
  onEdit,
  onDelete,
}: AssetsRegisterTableProps) {
  const warrantyBadgeMap = useWarrantyBadgeMap(t);

  const columns = useMemo<SmartTableColumn<AssetRegisterListItem>[]>(
    () => [
      {
        key: 'nameAr',
        size: 'name',
        header: t('assetName'),
        render: (_: unknown, row: AssetRegisterListItem) => (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-semibold text-noorix-text truncate" title={String(row.nameAr ?? '')}>
              {String(row.nameAr ?? '')}
            </span>
            {row.nameEn ? (
              <span className="text-[12px] text-noorix-muted truncate" title={String(row.nameEn)}>
                {String(row.nameEn)}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'serialNumber',
        size: 'serial-code',
        header: t('assetSerial'),
        render: (_: unknown, row: AssetRegisterListItem) => (
          <span className="text-[13px] ltr inline-block">{row.serialNumber || '—'}</span>
        ),
      },
      {
        key: 'purchaseDate',
        size: 'date',
        header: t('assetPurchaseDate'),
        render: (_: unknown, row: AssetRegisterListItem) => (
          <span className="text-[13px] ltr">{formatAssetDate(row.purchaseDate)}</span>
        ),
      },
      {
        key: 'acquisitionCost',
        size: 'money-sm',
        header: t('assetAcquisitionCost'),
        numeric: true,
        render: (_: unknown, row: AssetRegisterListItem) =>
          row.acquisitionCost != null ? (
            <span className="ltr">
              {formatMoney(row.acquisitionCost, lang)} <span className="nx-sar">SR</span>
            </span>
          ) : (
            '—'
          ),
      },
      {
        key: 'supplier',
        size: 'supplier',
        header: t('assetSupplier'),
        render: (_: unknown, row: AssetRegisterListItem) => {
          const supplierName = getSupplierDisplayName(row.supplier, lang);
          return (
            <span className="text-[13px] truncate max-w-full inline-block" title={supplierName}>
              {supplierName}
            </span>
          );
        },
      },
      {
        key: 'warrantyEndDate',
        size: 'date',
        header: t('assetWarrantyEnd'),
        render: (_: unknown, row: AssetRegisterListItem) => (
          <span className="text-[13px] ltr">{formatAssetDate(row.warrantyEndDate)}</span>
        ),
      },
      {
        key: 'warrantyStatus',
        size: 'document',
        header: t('assetWarrantyFilter'),
        render: (_: unknown, row: AssetRegisterListItem) => {
          const key = normalizeWarrantyStatus(row.warrantyStatus);
          const b = warrantyBadgeMap[key] ?? warrantyBadgeMap.none;
          return (
            <Badge color={b.color} size="sm">
              {b.label}
            </Badge>
          );
        },
      },
      {
        key: 'daysToWarrantyEnd',
        size: 'count',
        header: t('assetDaysToEnd'),
        numeric: true,
        render: (_: unknown, row: AssetRegisterListItem) =>
          row.daysToWarrantyEnd != null ? (
            <span className="ltr font-medium">{row.daysToWarrantyEnd}</span>
          ) : (
            '—'
          ),
      },
      ...(canWrite || canDelete
        ? [
            {
              key: 'actions',
              header: '',
              render: (_: unknown, row: AssetRegisterListItem) => (
                <KebabMenu
                  ariaLabel={t('edit')}
                  items={[
                    ...(canWrite ? [{ key: 'edit', label: t('edit'), onClick: () => onEdit(row) }] : []),
                    ...(canDelete
                      ? [
                          {
                            key: 'del',
                            label: t('delete'),
                            onClick: () => onDelete(row),
                            style: { color: 'var(--noorix-accent-red)' },
                          },
                        ]
                      : []),
                  ]}
                />
              ),
            },
          ]
        : []),
    ],
    [canDelete, canWrite, lang, onDelete, onEdit, t, warrantyBadgeMap],
  );

  const footerRow = useMemo(
    () => [
      {
        keys: ['nameAr', 'serialNumber', 'purchaseDate'],
        content: (
          <span className="text-[12px] font-semibold text-noorix-muted">{t('total')}</span>
        ),
      },
      {
        keys: ['acquisitionCost'],
        content: (
          <span className="text-[13px] font-bold ltr">
            {formatMoney(sumAll || 0, lang)} <span className="nx-sar">SR</span>
          </span>
        ),
      },
    ],
    [lang, sumAll, t],
  );

  const renderCompactRow = useCallback(
    (row: AssetRegisterListItem) => (
      <div>
        <div className="nx-cr__line1">
          <span className="nx-cr__name">{String(row.nameAr ?? '')}</span>
          {row.serialNumber && <span className="nx-cr__sub ltr">{String(row.serialNumber)}</span>}
          <Badge
            {...Badge.fromStatus(String(row.warrantyStatus ?? 'none'), {
              none: { color: 'gray', label: t('assetWarrantyNone') },
              active: { color: 'green', label: t('assetWarrantyActive') },
              expiring: { color: 'amber', label: t('assetWarrantyExpiring') },
              expired: { color: 'red', label: t('assetWarrantyExpired') },
            })}
            size="sm"
          />
        </div>
        <div className="nx-cr__line2">
          <div className="nx-cr__line2-start">
            <span className="nx-cr__meta ltr">{formatAssetDate(row.purchaseDate)}</span>
            {row.warrantyEndDate ? <span className="nx-cr__meta ltr">→ {String(formatAssetDate(row.warrantyEndDate))}</span> : null}
          </div>
          <div className="nx-cr__line2-end">
            {row.acquisitionCost != null && (
              <span className="nx-cr__amount text-noorix-green">{formatMoney(row.acquisitionCost, lang)} <span className="nx-sar">SR</span></span>
            )}
            {(canWrite || canDelete) && (
              <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
                <KebabMenu
                  ariaLabel={t('actions')}
                  items={[
                    ...(canWrite ? [{ key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: () => onEdit(row) }] : []),
                    ...(canDelete ? [{ key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: () => onDelete(row) }] : []),
                  ]}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    [t, lang, canWrite, canDelete, onEdit, onDelete],
  );

  const renderMobileCard = useCallback(
    (row: AssetRegisterListItem) => (
      <div className="flex flex-col gap-2 nx-mc__root">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold text-noorix-text">{String(row.nameAr ?? '')}</div>
            {row.serialNumber ? (
              <div className="text-[12px] text-noorix-muted ltr">{String(row.serialNumber)}</div>
            ) : null}
          </div>
          <Badge
            {...Badge.fromStatus(String(row.warrantyStatus ?? 'none'), {
              none: { color: 'gray', label: t('assetWarrantyNone') },
              active: { color: 'green', label: t('assetWarrantyActive') },
              expiring: { color: 'amber', label: t('assetWarrantyExpiring') },
              expired: { color: 'red', label: t('assetWarrantyExpired') },
            })}
            size="sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <div className="text-noorix-muted">{t('assetPurchaseDate')}</div>
            <div className="ltr font-medium">{formatAssetDate(row.purchaseDate)}</div>
          </div>
          <div>
            <div className="text-noorix-muted">{t('assetWarrantyEnd')}</div>
            <div className="ltr font-medium">{formatAssetDate(row.warrantyEndDate)}</div>
          </div>
          <div>
            <div className="text-noorix-muted">{t('assetAcquisitionCost')}</div>
            <div className="ltr font-bold text-noorix-green">
              {row.acquisitionCost != null ? formatMoney(row.acquisitionCost, lang) : '—'}{' '}
              {row.acquisitionCost != null ? <span className="nx-sar">SR</span> : null}
            </div>
          </div>
          <div>
            <div className="text-noorix-muted">{t('assetDaysToEnd')}</div>
            <div className="ltr font-medium">{row.daysToWarrantyEnd ?? '—'}</div>
          </div>
        </div>
      </div>
    ),
    [t, lang],
  );

  return (
    <SmartTable
      tableId="company-assets"
      title={t('assetsRegister')}
      columns={columns}
      data={items}
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      isLoading={isLoading}
      isError={isError}
      errorMessage={errorMessage}
      footerRow={footerRow}
      showSearchInHeader={false}
      emptyMessage={t('expenseLinesEmptyState')}
      renderCompactRow={renderCompactRow}
      renderMobileCard={renderMobileCard}
      tableMinWidth={960}
    />
  );
}

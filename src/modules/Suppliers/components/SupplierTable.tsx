import React, { memo, type ChangeEvent, type CSSProperties } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Badge, Button, Checkbox, SmartTable } from '../../../ui';
import type { SmartTableColumn } from '../../../ui/SmartTable/types';
import type { SupplierCategoryRecord, SupplierRecord } from '../supplierTypes';
import {
  findSupplierCategory,
  getSupplierCategoryName,
  getSupplierName,
  getSupplierSecondaryName,
  getSupplierTypeBadgeMeta,
} from '../supplierDisplayModel';

function TypeBadge({ type }: { type: SupplierRecord['supplierType'] }) {
  const { t } = useTranslation();
  const meta = getSupplierTypeBadgeMeta(type);
  return (
    <Badge color={meta.color} size="sm">
      {t(meta.labelKey)}
    </Badge>
  );
}

function SupplierNameCell({
  supplier,
  lang,
  onOpenProfile,
}: {
  supplier: SupplierRecord;
  lang: string;
  onOpenProfile?: (supplier: SupplierRecord) => void;
}) {
  const primaryName = getSupplierName(supplier, lang);
  const secondaryName = getSupplierSecondaryName(supplier, lang);
  const showSecondary = secondaryName !== '-' && secondaryName !== primaryName;

  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <Button
        type="button"
        variant="raw"
        size="auto"
        className="max-w-full truncate text-start font-bold text-noorix-blue hover:underline"
        onClick={() => onOpenProfile?.(supplier)}
      >
        {primaryName}
      </Button>
      {showSecondary && (
        <span className="max-w-full truncate text-[12px] font-medium text-noorix-muted" title={secondaryName}>
          {secondaryName}
        </span>
      )}
    </div>
  );
}

type SupplierCheckboxProps = {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
};

function SupplierCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: SupplierCheckboxProps) {
  return (
    <Checkbox
      checked={checked}
      ref={(element: HTMLInputElement | null) => {
        if (element) element.indeterminate = indeterminate;
      }}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)}
      aria-label={ariaLabel}
      className="cursor-pointer"
      containerClassName="nx-checkbox nx-checkbox--hit-36 nx-checkbox--accent-green p-1"
    />
  );
}

export type SupplierTableProps = {
  suppliers?: SupplierRecord[];
  flatCategories?: SupplierCategoryRecord[];
  onOpenProfile?: (supplier: SupplierRecord) => void;
  selectedIds?: Set<string>;
  onSelectChange?: (id: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  onBulkDelete?: () => void | Promise<void>;
};

export const SupplierTable = memo(function SupplierTable({
  suppliers = [],
  flatCategories = [],
  onOpenProfile,
  selectedIds = new Set<string>(),
  onSelectChange,
  onSelectAll,
  onBulkDelete,
}: SupplierTableProps) {
  const { t, lang } = useTranslation();

  const allSelected = suppliers.length > 0 && selectedIds.size === suppliers.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const hasSelection = selectedIds.size > 0;

  if (suppliers.length === 0) {
    return (
      <div className="text-center text-noorix-muted p-5 rounded-xl border-2 border-dashed border-noorix-border">
        <div className="mb-2 text-noorix-muted text-[20px]">-</div>
        <p className="m-0 text-[13px]">{t('noSuppliers')}</p>
      </div>
    );
  }

  const columns: SmartTableColumn<SupplierRecord>[] = [
    {
      key: 'select',
      kind: 'meta',
      shrink: true,
      width: 40,
      minWidth: 40,
      maxWidth: 40,
      align: 'center',
      cellClassName: 'nx-selection-cell',
      label: (
        <SupplierCheckbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={(checked) => onSelectAll?.(checked)}
          ariaLabel="تحديد الكل"
        />
      ),
      render: (_value, row) => (
        <SupplierCheckbox
          checked={selectedIds.has(row.id)}
          onChange={(checked) => onSelectChange?.(row.id, checked)}
          ariaLabel={`تحديد ${row.nameAr}`}
        />
      ),
    },
    {
      key: 'nameAr',
      size: 'name',
      label: t('supplierName'),
      minWidth: 220,
      render: (_value, row) => (
        <SupplierNameCell supplier={row} lang={lang} onOpenProfile={onOpenProfile} />
      ),
    },
    {
      key: 'taxNumber',
      label: t('taxNumber'),
      numeric: true,
      align: 'center',
      shrink: true,
      minWidth: 145,
      render: (value) => <span className="nx-cell-num whitespace-nowrap">{String(value || '-')}</span>,
    },
    {
      key: 'supplierCategoryId',
      label: t('category'),
      align: 'center',
      shrink: true,
      render: (_value, row) => {
        const category = findSupplierCategory(flatCategories, row);
        if (!category) return <span className="nx-cell-muted">-</span>;
        const icon = category.icon || category.account?.icon || '';
        return (
          <span className="flex items-center justify-center gap-1">
            {icon && <span className="text-[14px]">{icon}</span>}
            <Badge color={category.type === 'purchase' ? 'blue' : 'amber'} size="sm">
              {getSupplierCategoryName(category, lang)}
              {category.account?.code && <span className="me-1 opacity-70">[{category.account.code}]</span>}
            </Badge>
          </span>
        );
      },
    },
    {
      key: 'isTaxRegistered',
      label: t('taxRegisteredCol'),
      align: 'center',
      shrink: true,
      render: (_value, row) =>
        row.isTaxRegistered == null ? (
          <span className="nx-cell-muted text-[12px]">-</span>
        ) : row.isTaxRegistered ? (
          <Badge color="green" size="sm" title={t('taxRegisteredHint')}>{t('taxRegisteredBadgeYes')}</Badge>
        ) : (
          <Badge color="gray" size="sm" title={t('taxNotRegisteredHint')}>{t('taxRegisteredBadgeNo')}</Badge>
        ),
    },
    {
      key: 'supplierType',
      label: t('type'),
      align: 'center',
      shrink: true,
      render: (_value, row) => <TypeBadge type={row.supplierType || 'purchases'} />,
    },
  ];

  const badge = hasSelection ? (
    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
      <span className="text-[13px] font-bold text-noorix-red flex-1 min-w-0">
        تم تحديد {selectedIds.size} {selectedIds.size === 1 ? 'مورد' : 'موردين'}
      </span>
      <Button variant="danger" size="sm" onClick={() => onBulkDelete?.()}>حذف المحددين</Button>
      <Button size="sm" onClick={() => onSelectAll?.(false)}>إلغاء التحديد</Button>
    </div>
  ) : (
    <span className="text-[12px] text-noorix-muted">{t('supplierCount', suppliers.length)}</span>
  );

  return (
    <SmartTable
      columns={columns}
      data={suppliers}
      badge={badge}
      compact={false}
      tableLayout="auto"
      stickyActionColumn={false}
      tableId="suppliers-list"
      mobileMode="table"
      tableMinWidth={760}
      innerPadding={0}
      getRowStyle={(row): CSSProperties | undefined =>
        selectedIds.has(row.id) ? { background: 'var(--noorix-green-4)' } : undefined
      }
      renderCompactRow={(row) => {
        const category = findSupplierCategory(flatCategories, row);
        const checked = selectedIds.has(row.id);
        return (
          <div className={`-my-[9px] -mx-[14px] py-[9px] px-[14px] ${checked ? 'bg-[var(--noorix-green-4)]' : 'bg-transparent'}`}>
            <div className="nx-cr__line1">
              <div onClick={(event) => event.stopPropagation()}>
                <SupplierCheckbox
                  checked={checked}
                  onChange={(nextChecked) => onSelectChange?.(row.id, nextChecked)}
                  ariaLabel={`تحديد ${row.nameAr}`}
                />
              </div>
              <Button
                type="button"
                variant="raw"
                size="auto"
                className="nx-cr__name text-noorix-blue hover:underline"
                onClick={() => onOpenProfile?.(row)}
              >
                {getSupplierName(row, lang)}
              </Button>
              <TypeBadge type={row.supplierType || 'purchases'} />
              {row.isTaxRegistered != null && (
                row.isTaxRegistered
                  ? <Badge color="green" size="sm">{t('taxRegisteredBadgeYes')}</Badge>
                  : <Badge color="gray" size="sm">{t('taxRegisteredBadgeNo')}</Badge>
              )}
            </div>
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">
                {category && <span className="nx-cr__meta">{getSupplierCategoryName(category, lang)}</span>}
                {row.taxNumber && <span className="nx-cr__meta nx-cell-num">{row.taxNumber}</span>}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
});

export default SupplierTable;

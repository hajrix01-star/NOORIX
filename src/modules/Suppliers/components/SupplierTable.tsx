/**
 * SupplierTable — جدول عرض الموردين مع تحديد متعدد وحذف جماعي.
 * Props: suppliers, flatCategories, onEdit, onDelete,
 *        selectedIds (Set), onSelectChange(id,bool), onSelectAll(bool),
 *        onBulkDelete
 */
import React, { memo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Badge, Button, SmartTable, KebabMenu } from '../../../ui';

const sName = (s: any, lang: any) => (lang === 'en' ? s?.nameEn || s?.nameAr : s?.nameAr || s?.nameEn) || '—';

/* ── بادج نوع المورد ── */
function TypeBadge({ type }: any) {
  const colorMap: Record<string, string> = {
    purchase:  'blue',
    purchases: 'blue',
    expense:   'amber',
    expenses:  'amber',
  };
  const labelMap: Record<string, string> = {
    purchase:  'categoryTypes',
    purchases: 'categoryTypes',
    expense:   'categoryTypeExpense',
    expenses:  'categoryTypeExpense',
  };
  const { t } = useTranslation();
  const color = colorMap[String(type)] || 'gray';
  const labelKey = labelMap[String(type)];
  return (
    <Badge color={color} size="sm">
      {labelKey ? t(labelKey) : type}
    </Badge>
  );
}

/* ── checkbox مُنسَّق ── */
function CB({ checked, indeterminate, onChange, ariaLabel }: any) {
  return (
    <label className="nx-checkbox nx-checkbox--hit-36 nx-checkbox--accent-green p-1">
      <input
        type="checkbox"
        checked={checked}
        ref={(el: any) => { if (el) el.indeterminate = !!indeterminate; }}
        onChange={(e: any) => onChange(e.target.checked)}
        aria-label={ariaLabel}
        className="cursor-pointer"
      />
    </label>
  );
}

export type SupplierTableProps = {
  suppliers?: any[];
  flatCategories?: any[];
  onEdit?: (s: any) => void;
  onOpenProfile?: (s: any) => void;
  onDelete?: (s: any) => void;
  selectedIds?: Set<any>;
  onSelectChange?: (id: any, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  onBulkDelete?: () => void | Promise<void>;
};

export const SupplierTable = memo(function SupplierTable({
  suppliers = [],
  flatCategories = [],
  onEdit,
  onOpenProfile,
  onDelete,
  selectedIds = new Set(),
  onSelectChange,
  onSelectAll,
  onBulkDelete,
}: SupplierTableProps) {
  const { t, lang } = useTranslation();

  const allSelected  = suppliers.length > 0 && selectedIds.size === suppliers.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const hasSelection = selectedIds.size > 0;

  if (suppliers.length === 0) {
    return (
      <div className="text-center text-noorix-muted p-5 rounded-xl" style={{ border: '2px dashed var(--noorix-border)' }}>
        <div className="mb-2 text-noorix-muted text-[20px]">—</div>
        <p className="m-0 text-[13px]">{t('noSuppliers')}</p>
      </div>
    );
  }

  const columns = [
    {
      key: 'select',
      shrink: true,
      width: 44,
      align: 'center',
      label: (
        <CB
          checked={allSelected}
          indeterminate={someSelected}
          onChange={(v: any) => onSelectAll?.(v)}
          ariaLabel="تحديد الكل"
        />
      ),
      render: (_: any, row: any) => (
        <CB
          checked={selectedIds.has(row.id)}
          indeterminate={false}
          onChange={(v: any) => onSelectChange?.(row.id, v)}
          ariaLabel={`تحديد ${row.nameAr}`}
        />
      ),
    },
    {
      key: 'nameAr',
      label: t('name'),
      minWidth: 160,
      render: (_: any, row: any) => (
        <button
          type="button"
          className="font-bold text-noorix-blue hover:underline"
          onClick={() => onOpenProfile?.(row)}
        >
          {sName(row, lang)}
        </button>
      ),
    },
    {
      key: 'nameEn',
      label: t('nameEnCol'),
      minWidth: 140,
      render: (_: any, row: any) => (
        <span className="nx-cell-muted">
          {lang === 'en' ? (row.nameAr || '—') : (row.nameEn || '—')}
        </span>
      ),
    },
    {
      key: 'taxNumber',
      label: t('taxNumber'),
      numeric: true,
      align: 'center',
      shrink: true,
      minWidth: 145,
      render: (v: any) => <span className="nx-cell-num whitespace-nowrap">{v || '—'}</span>,
    },
    {
      key: 'phone',
      label: t('phone'),
      align: 'center',
      shrink: true,
      minWidth: 110,
      render: (v: any) => <span className="nx-cell-muted whitespace-nowrap">{v || '—'}</span>,
    },
    {
      key: 'supplierCategoryId',
      label: t('category'),
      align: 'center',
      shrink: true,
      render: (_: any, row: any) => {
        const cat  = flatCategories.find((c: any) => c.id === row.supplierCategoryId);
        if (!cat) return <span className="nx-cell-muted">—</span>;
        const icon    = cat?.icon || cat?.account?.icon || '';
        const catName = lang === 'en' ? cat.nameEn || cat.nameAr : cat.nameAr || cat.nameEn;
        return (
          <span className="flex items-center justify-center gap-1">
            {icon && <span className="text-[14px]">{icon}</span>}
            <Badge color={cat.type === 'purchase' ? 'blue' : 'amber'} size="sm">
              {catName}
              {cat.account?.code && <span className="me-1 opacity-70">[{cat.account.code}]</span>}
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
      render: (_: any, row: any) =>
        row.isTaxRegistered == null ? (
          <span className="nx-cell-muted text-[12px]">—</span>
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
      render: (_: any, row: any) => <TypeBadge type={row.supplierType || 'purchases'} />,
    },
    {
      key: 'actions',
      label: t('actions'),
      align: 'center',
      shrink: true,
      width: '1%',
      render: (_: any, row: any) => (
        <KebabMenu
          ariaLabel={t('actions')}
          items={[
            { key: 'edit',   label: t('edit'),   style: { color: 'var(--noorix-accent-green)' }, onClick: () => onEdit?.(row) },
            { key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' },   onClick: () => onDelete?.(row) },
          ]}
        />
      ),
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
      tableMinWidth={860}
      innerPadding={0}
      getRowStyle={(row: any) =>
        selectedIds.has(row.id) ? { background: 'var(--noorix-green-4)' } : undefined
      }
      renderCompactRow={(row: any) => {
        const cat     = flatCategories.find((c: any) => c.id === row.supplierCategoryId);
        const catName = cat ? (lang === 'en' ? cat.nameEn || cat.nameAr : cat.nameAr || cat.nameEn) : null;
        const checked = selectedIds.has(row.id);
        return (
          <div style={{ background: checked ? 'var(--noorix-green-4)' : 'transparent', margin: '-9px -14px', padding: '9px 14px' }}>
            {/* السطر الأول: checkbox + الاسم + نوع + حالة الضريبة */}
            <div className="nx-cr__line1">
              <div onClick={(e) => e.stopPropagation()}>
                <CB
                  checked={checked}
                  indeterminate={false}
                  onChange={(v: any) => onSelectChange?.(row.id, v)}
                  ariaLabel={`تحديد ${row.nameAr}`}
                />
              </div>
              <button
                type="button"
                className="nx-cr__name text-noorix-blue hover:underline"
                onClick={() => onOpenProfile?.(row)}
              >
                {sName(row, lang)}
              </button>
              <TypeBadge type={row.supplierType || 'purchases'} />
              {row.isTaxRegistered != null && (
                row.isTaxRegistered
                  ? <Badge color="green" size="sm">{t('taxRegisteredBadgeYes')}</Badge>
                  : <Badge color="gray"  size="sm">{t('taxRegisteredBadgeNo')}</Badge>
              )}
            </div>
            {/* السطر الثاني: التصنيف + هاتف/رقم ضريبي + كباب */}
            <div className="nx-cr__line2">
              <div className="nx-cr__line2-start">
                {catName && <span className="nx-cr__meta">{catName}</span>}
                {row.phone && <span className="nx-cr__meta">{row.phone}</span>}
                {row.taxNumber && <span className="nx-cr__meta nx-cell-num">{row.taxNumber}</span>}
              </div>
              <div className="nx-cr__kebab" onClick={(e) => e.stopPropagation()}>
                <KebabMenu
                  ariaLabel={t('actions')}
                  items={[
                    { key: 'edit',   label: t('edit'),   style: { color: 'var(--noorix-accent-green)' }, onClick: () => onEdit?.(row) },
                    { key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' },   onClick: () => onDelete?.(row) },
                  ]}
                />
              </div>
            </div>
          </div>
        );
      }}
    />
  );
});

export default SupplierTable;

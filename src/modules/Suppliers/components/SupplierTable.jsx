/**
 * SupplierTable — جدول عرض الموردين مع تحديد متعدد وحذف جماعي.
 * Props: suppliers, flatCategories, onEdit, onDelete,
 *        selectedIds (Set), onSelectChange(id,bool), onSelectAll(bool),
 *        onBulkDelete
 */
import React, { memo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Badge, Button, SmartTable } from '../../../ui';

const sName = (s, lang) => (lang === 'en' ? s?.nameEn || s?.nameAr : s?.nameAr || s?.nameEn) || '—';

/* ── بادج نوع المورد ── */
function TypeBadge({ type }) {
  const colorMap = {
    purchase:  'blue',
    purchases: 'blue',
    expense:   'amber',
    expenses:  'amber',
  };
  const labelMap = {
    purchase:  'categoryTypes',
    purchases: 'categoryTypes',
    expense:   'categoryTypeExpense',
    expenses:  'categoryTypeExpense',
  };
  const { t } = useTranslation();
  const color = colorMap[type] || 'gray';
  const labelKey = labelMap[type];
  return (
    <Badge color={color} size="sm">
      {labelKey ? t(labelKey) : type}
    </Badge>
  );
}

/* ── checkbox مُنسَّق ── */
function CB({ checked, indeterminate, onChange, ariaLabel }) {
  return (
    <label className="nx-checkbox nx-checkbox--hit-36 nx-checkbox--accent-green p-1">
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => { if (el) el.indeterminate = !!indeterminate; }}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
        className="cursor-pointer"
      />
    </label>
  );
}

/* ── أزرار الإجراء ── */
function ActionBtns({ onEdit, onDelete, t }) {
  return (
    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
      <Button size="sm" onClick={onEdit}>✎ {t('edit')}</Button>
      <Button size="sm" variant="danger" onClick={onDelete}>× {t('delete')}</Button>
    </div>
  );
}

export const SupplierTable = memo(function SupplierTable({
  suppliers = [],
  flatCategories = [],
  onEdit,
  onDelete,
  selectedIds = new Set(),
  onSelectChange,
  onSelectAll,
  onBulkDelete,
}) {
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
      label: (
        <CB
          checked={allSelected}
          indeterminate={someSelected}
          onChange={(v) => onSelectAll?.(v)}
          ariaLabel="تحديد الكل"
        />
      ),
      render: (_, row) => (
        <CB
          checked={selectedIds.has(row.id)}
          onChange={(v) => onSelectChange?.(row.id, v)}
          ariaLabel={`تحديد ${row.nameAr}`}
        />
      ),
    },
    {
      key: 'nameAr',
      label: t('name'),
      render: (_, row) => <span className="font-bold">{sName(row, lang)}</span>,
    },
    {
      key: 'nameEn',
      label: t('nameEnCol'),
      render: (_, row) => (
        <span className="nx-cell-muted">
          {lang === 'en' ? (row.nameAr || '—') : (row.nameEn || '—')}
        </span>
      ),
    },
    { key: 'taxNumber', label: t('taxNumber'), numeric: true },
    { key: 'phone',     label: t('phone') },
    {
      key: 'supplierCategoryId',
      label: t('category'),
      render: (_, row) => {
        const cat  = flatCategories.find((c) => c.id === row.supplierCategoryId);
        if (!cat) return '—';
        const icon = cat?.icon || cat?.account?.icon || '';
        return (
          <span className="flex items-center gap-1">
            {icon && <span className="text-[14px]">{icon}</span>}
            <Badge color={cat.type === 'purchase' ? 'blue' : 'amber'} size="sm">
              {cat.nameAr}
              {cat.account?.code && <span className="me-1 opacity-70">[{cat.account.code}]</span>}
            </Badge>
          </span>
        );
      },
    },
    {
      key: 'supplierType',
      label: t('type'),
      shrink: true,
      render: (_, row) => <TypeBadge type={row.supplierType || 'purchases'} />,
    },
    {
      key: 'actions',
      label: t('actions'),
      shrink: true,
      render: (_, row) => (
        <ActionBtns onEdit={() => onEdit?.(row)} onDelete={() => onDelete?.(row)} t={t} />
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
      tableMinWidth={560}
      getRowStyle={(row) =>
        selectedIds.has(row.id) ? { background: 'var(--noorix-green-4)' } : undefined
      }
      renderMobileCard={(row) => {
        const cat     = flatCategories.find((c) => c.id === row.supplierCategoryId);
        const icon    = cat?.icon || cat?.account?.icon || '';
        const checked = selectedIds.has(row.id);
        return (
          <div
            style={{
              background: checked ? 'var(--noorix-green-4)' : 'transparent',
              margin: '-12px -16px',
              padding: '12px 16px',
            }}
          >
            <div className="flex gap-2 items-start">
              <CB
                checked={checked}
                onChange={(v) => onSelectChange?.(row.id, v)}
                ariaLabel={`تحديد ${row.nameAr}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex mb-1 justify-between items-start">
                  <div>
                    <div className="font-bold text-[14px]">{sName(row, lang)}</div>
                    {row.nameEn && row.nameAr && lang !== 'en' && (
                      <div className="nx-cell-muted">{row.nameEn}</div>
                    )}
                    {row.nameAr && lang === 'en' && (
                      <div className="nx-cell-muted">{row.nameAr}</div>
                    )}
                  </div>
                  <TypeBadge type={row.supplierType || 'purchases'} />
                </div>
                {(row.phone || row.taxNumber) && (
                  <div className="flex gap-3 text-[12px] text-noorix-muted mb-1">
                    {row.phone && <span>{row.phone}</span>}
                    {row.taxNumber && <span className="nx-cell-num">{row.taxNumber}</span>}
                  </div>
                )}
                {cat && (
                  <div className="mb-2">
                    <Badge color={cat.type === 'purchase' ? 'blue' : 'amber'} size="sm">
                      {icon && <span>{icon}</span>}{cat.nameAr}
                    </Badge>
                  </div>
                )}
                <ActionBtns
                  onEdit={() => onEdit?.(row)}
                  onDelete={() => onDelete?.(row)}
                  t={t}
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

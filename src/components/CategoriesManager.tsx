/**
 * CategoriesManager — مكون مشترك لإدارة التصنيفات (فئات الحسابات)
 * يُستخدم في: Suppliers/CategoriesTab (الموردين والتصنيفات)
 */
import React, { useState, useMemo, memo, type ChangeEvent, type FormEvent } from 'react';
import { useCategories } from '../hooks/useCategories';
import { useTranslation } from '../i18n/useTranslation';
import { useToast } from '../context/ToastContext';
import { Button, Input, Card, Badge, FormRow, SmartTable } from '../ui';

const TYPE_MAP = {
  purchase: { labelKey: 'categoryTypes' },
  expense: { labelKey: 'categoryTypeExpense' },
  sale: { labelKey: 'categoryTypeSale' },
} as const;

const TYPE_BADGE_COLOR: Record<string, 'blue' | 'amber' | 'green' | 'gray'> = {
  purchase: 'blue',
  expense: 'amber',
  sale: 'green',
};

type CategoryKind = keyof typeof TYPE_MAP;

type CategoryNode = {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
  type?: string;
  icon?: string | null;
  parentId?: string | null;
  code?: string | null;
  account?: { code?: string | null } | null;
  children?: CategoryNode[];
};

type CategoryRow = CategoryNode & {
  _level: number;
  _parentName?: string;
  _parentCode?: string;
};

type FormState = {
  nameAr: string;
  nameEn: string;
  type: CategoryKind;
  icon: string;
  parentId: string;
};

type CategoriesManagerProps = { companyId?: string | null; titleKey?: string };

/** عرض الكود التحليلي مع لون يختلف حسب المستوى */
function CodeBadge({ row }: { row: CategoryRow }) {
  const displayCode = row.code || row.account?.code || null;
  if (!displayCode) return <span className="text-noorix-muted text-[11px]">—</span>;

  const isParent = row._level === 0;
  return (
    <span
      className={[
        'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none',
        isParent
          ? 'bg-blue-50 text-noorix-blue border border-blue-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200',
      ].join(' ')}
    >
      {displayCode}
    </span>
  );
}

export const CategoriesManager = memo(function CategoriesManager({
  companyId,
  titleKey = 'categoriesTab',
}: CategoriesManagerProps) {
  const { t, lang } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>({
    nameAr: '',
    nameEn: '',
    type: 'purchase',
    icon: '',
    parentId: '',
  });
  const codeColumnLabel = lang === 'en' ? 'Code' : 'الكود';

  const { categories, isLoading, create, update, remove } = useCategories(companyId);
  const roots = useMemo(
    () => (categories as CategoryNode[]).filter((c: any) => !c.parentId),
    [categories],
  );

  const handleParentChange = (parentId: string) => {
    const parent = roots.find((c: any) => c.id === parentId);
    setForm((p: any) => ({
      ...p,
      parentId: parentId || '',
      type: (parent?.type as CategoryKind) || p.type,
    }));
  };

  const rows = useMemo((): CategoryRow[] => {
    const list: CategoryRow[] = [];
    for (const cat of categories as CategoryNode[]) {
      list.push({ ...cat, _level: 0 });
      for (const child of cat.children || []) {
        list.push({
          ...child,
          _level: 1,
          _parentName: cat.nameAr ?? undefined,
          _parentCode: cat.code || cat.account?.code || '',
        });
      }
    }
    return list;
  }, [categories]);

  const typeLabels = useMemo(
    () => ({
      purchase: t(TYPE_MAP.purchase.labelKey),
      expense: t(TYPE_MAP.expense.labelKey),
      sale: t(TYPE_MAP.sale.labelKey),
    }),
    [t],
  );

  function resetForm() {
    setForm({ nameAr: '', nameEn: '', type: 'purchase', icon: '', parentId: '' });
    setEditing(null);
    setShowForm(false);
  }

  function openEdit(cat: CategoryRow) {
    setEditing(cat);
    setForm({
      nameAr: cat.nameAr || '',
      nameEn: cat.nameEn || '',
      type: (cat.type as CategoryKind) || 'purchase',
      icon: cat.icon || '',
      parentId: cat.parentId || '',
    });
    setShowForm(true);
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.nameAr?.trim()) return;
    if (!companyId) {
      showToast(t('pleaseSelectCompanyFirst'), 'error');
      return;
    }
    if (editing) {
      update.mutate(
        {
          id: editing.id,
          body: {
            companyId,
            nameAr: form.nameAr.trim(),
            nameEn: form.nameEn?.trim() || null,
            type: form.type,
            parentId: form.parentId || null,
            icon: form.icon || null,
          },
        },
        {
          onSuccess: () => {
            showToast(t('updateSuccess'), 'success');
            resetForm();
          },
          onError: (e: unknown) =>
            showToast(e instanceof Error ? e.message : t('updateFailed'), 'error'),
        },
      );
    } else {
      create.mutate(
        {
          companyId,
          nameAr: form.nameAr.trim(),
          nameEn: form.nameEn?.trim() || undefined,
          type: form.type,
          icon: form.icon || undefined,
          parentId: form.parentId || undefined,
          createAccount: true,
        },
        {
          onSuccess: () => {
            showToast(t('categoryAdded'), 'success');
            resetForm();
          },
          onError: (e: unknown) =>
            showToast(e instanceof Error ? e.message : t('addFailed'), 'error'),
        },
      );
    }
  }

  function handleDelete(cat: CategoryRow) {
    if (!confirm(t('deleteCategoryConfirm', cat.nameAr))) return;
    remove.mutate(cat.id, {
      onSuccess: () => showToast(t('categoryDeleted'), 'success'),
      onError: (e: unknown) =>
        showToast(e instanceof Error ? e.message : t('deleteFailed'), 'error'),
    });
  }

  const columns = useMemo(
    () => [
      {
        key: 'nameAr',
        label: t('nameAr'),
        align: 'right' as const,
        render: (v: unknown, row: CategoryRow) => (
          <span
            className={[
              'flex items-center gap-1 text-right',
              row._level === 0 ? 'font-bold text-noorix-text' : 'font-medium text-noorix-muted',
            ].join(' ')}
            style={{ paddingRight: row._level === 1 ? 28 : 0 }}
          >
            {row._level === 1 && <span className="text-noorix-muted text-[11px] shrink-0">↳</span>}
            {row.icon ? <span>{row.icon}</span> : null}
            <span>{(v as string) || '—'}</span>
          </span>
        ),
      },
      { key: 'code', label: codeColumnLabel, render: (_: unknown, row: CategoryRow) => <CodeBadge row={row} /> },
      {
        key: 'nameEn',
        label: t('nameEnCol'),
        render: (v: unknown, row: CategoryRow) => (
          <span
            className={
              row._level === 0 ? 'text-[13px] text-noorix-muted' : 'text-[12px] text-noorix-muted opacity-70'
            }
          >
            {(v as string) || '—'}
          </span>
        ),
      },
      {
        key: 'type',
        label: t('type'),
        render: (v: unknown) => {
          const key = String(v ?? '');
          return (
            <Badge color={TYPE_BADGE_COLOR[key] ?? 'gray'} size="sm">
              {typeLabels[key as CategoryKind] || key}
            </Badge>
          );
        },
      },
      {
        key: 'parent',
        label: t('parentCategory'),
        render: (_: unknown, row: CategoryRow) => (
          <span className="text-[12px] text-noorix-muted">
            {row._parentName ? (
              <>
                {row._parentName}
                {row._parentCode && (
                  <span className="ms-1 font-mono text-[11px] text-noorix-blue opacity-70">[{row._parentCode}]</span>
                )}
              </>
            ) : (
              '—'
            )}
          </span>
        ),
      },
      {
        key: 'actions',
        label: t('actions'),
        render: (_: unknown, row: CategoryRow) => (
          <span className="inline-flex gap-1.5">
            <Button size="sm" onClick={() => openEdit(row)}>
              {t('edit')}
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>
              {t('delete')}
            </Button>
          </span>
        ),
      },
    ],
    [codeColumnLabel, t, typeLabels],
  );

  if (!companyId) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex items-center justify-end">
        <Button variant={showForm ? 'default' : 'primary'} onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? t('cancel') : t('addCategory')}
        </Button>
      </div>
      {showForm && (
        <Card>
          <h4 className="text-[14px] m-0 mb-4">{editing ? t('editCategory') : t('newCategory')}</h4>
          <form onSubmit={handleSave}>
            <FormRow cols={2} className="mb-3.5">
              <Input
                type="text"
                label={`${t('nameAr')} *`}
                value={form.nameAr}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((p: any) => ({ ...p, nameAr: e.target.value }))}
              />
              <Input
                type="text"
                label={t('nameEnCol')}
                value={form.nameEn}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((p: any) => ({ ...p, nameEn: e.target.value }))}
              />
              <Input
                type="select"
                label={t('type')}
                value={form.type}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setForm((p: any) => ({ ...p, type: e.target.value as CategoryKind }))}
              >
                <option value="purchase">{t('categoryTypes')}</option>
                <option value="expense">{t('categoryTypeExpense')}</option>
                <option value="sale">{t('categoryTypeSale')}</option>
              </Input>
              <Input
                type="text"
                label={t('icon')}
                value={form.icon}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((p: any) => ({ ...p, icon: e.target.value }))}
                placeholder=""
              />
            </FormRow>
            <div className="mb-[14px]">
              <Input
                type="select"
                label={t('parentCategory')}
                value={form.parentId}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => handleParentChange(e.target.value)}
              >
                <option value="">— تصنيف رئيسي —</option>
                {roots
                  .filter((c: any) => c.id !== editing?.id)
                  .map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.icon || ''} {lang === 'en' ? c.nameEn || c.nameAr : c.nameAr || c.nameEn}
                      {c.code || c.account?.code ? ` [${c.code || c.account?.code}]` : ''}
                    </option>
                  ))}
              </Input>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="primary"
                disabled={create.isPending || update.isPending}
                loading={create.isPending || update.isPending}
              >
                {create.isPending || update.isPending ? t('saving') : t('save')}
              </Button>
              <Button type="button" onClick={resetForm}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        </Card>
      )}
      <div className="text-end mb-2">
        <h3 className="text-[16px] font-bold m-0">{t(titleKey)}</h3>
      </div>
      <SmartTable
        columns={columns}
        data={rows}
        total={rows.length}
        page={1}
        pageSize={50}
        showRowNumbers
        rowNumberWidth="1%"
        isLoading={isLoading}
        emptyMessage={t('noCategories')}
      />
    </div>
  );
});

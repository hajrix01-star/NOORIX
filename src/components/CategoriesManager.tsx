/**
 * CategoriesManager — مكون مشترك لإدارة التصنيفات (فئات الحسابات)
 * يُستخدم في: Suppliers/CategoriesTab (الموردين والتصنيفات)
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
  type FormEvent,
} from 'react';
import { useCategories } from '../hooks/useCategories';
import { useTranslation } from '../i18n/useTranslation';
import { useToast } from '../context/ToastContext';
import { Button, Badge, SmartTable } from '../ui';
import {
  CategoriesManagerForm,
  CodeBadge,
  TYPE_BADGE_COLOR,
  TYPE_MAP,
  type CategoryFormState,
  type CategoryKind,
  type CategoryNode,
  type CategoryRow,
} from './CategoriesManagerParts';

type CategoriesManagerProps = {
  companyId?: string | null;
  openCreateSignal?: number;
};

export const CategoriesManager = memo(function CategoriesManager({
  companyId,
  openCreateSignal,
}: CategoriesManagerProps) {
  const { t, lang } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const lastOpenCreateSignal = useRef(openCreateSignal);
  const { showToast } = useToast();
  const [form, setForm] = useState<CategoryFormState>({
    nameAr: '',
    nameEn: '',
    type: 'purchase',
    icon: '',
    parentId: '',
  });
  const codeColumnLabel = lang === 'en' ? 'Code' : 'الكود';

  const { categories, isLoading, create, update, remove } = useCategories(companyId);
  const roots = useMemo(
    () => (categories as CategoryNode[]).filter((c) => !c.parentId),
    [categories],
  );

  const parentPickerOptions = useMemo(
    () =>
      roots
        .filter((c) => c.id !== editing?.id)
        .map((c) => ({
          value: c.id,
          label: `${c.icon || ''} ${lang === 'en' ? c.nameEn || c.nameAr : c.nameAr || c.nameEn}${
            c.code || c.account?.code ? ` [${c.code || c.account?.code}]` : ''
          }`.trim(),
        })),
    [roots, editing?.id, lang],
  );

  const handleParentChange = (parentId: string) => {
    const parent = roots.find((c) => c.id === parentId);
    setForm((p) => ({
      ...p,
      parentId: parentId || '',
      type: (parent?.type as CategoryKind) || p.type,
    }));
  };

  const handleFieldChange = <K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
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

  const resetFormState = useCallback(() => {
    setForm({ nameAr: '', nameEn: '', type: 'purchase', icon: '', parentId: '' });
    setEditing(null);
  }, []);

  function resetForm() {
    resetFormState();
    setShowForm(false);
  }

  const openCreate = useCallback(() => {
    resetFormState();
    setShowForm(true);
  }, [resetFormState]);

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

  useEffect(() => {
    if (openCreateSignal == null || openCreateSignal === lastOpenCreateSignal.current) return;
    lastOpenCreateSignal.current = openCreateSignal;
    openCreate();
  }, [openCreate, openCreateSignal]);

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
        kind: 'text' as const,
        size: 'name' as const,
        minWidth: '20ch',
        align: 'right' as const,
        render: (v: unknown, row: CategoryRow) => (
          <span
            className={[
              'flex items-center gap-1 text-right',
              row._level === 0 ? 'font-bold text-noorix-text' : 'font-medium text-noorix-muted',
              row._level === 1 ? 'pe-7' : '',
            ].join(' ')}
          >
            {row._level === 1 && <span className="text-noorix-muted text-[11px] shrink-0">↳</span>}
            {row.icon ? <span>{row.icon}</span> : null}
            <span>{(v as string) || '—'}</span>
          </span>
        ),
      },
      {
        key: 'code',
        label: codeColumnLabel,
        kind: 'id' as const,
        size: 'code-sm' as const,
        render: (_: unknown, row: CategoryRow) => <CodeBadge row={row} />,
      },
      {
        key: 'nameEn',
        label: t('nameEnCol'),
        kind: 'text' as const,
        minWidth: '18ch',
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
        kind: 'status' as const,
        minWidth: '10ch',
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
        kind: 'text' as const,
        minWidth: '20ch',
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
        kind: 'actions' as const,
        width: '132px',
        minWidth: '132px',
        maxWidth: '148px',
        render: (_: unknown, row: CategoryRow) => (
          <span className="noorix-actions-row">
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
      <CategoriesManagerForm
        open={showForm}
        editing={editing}
        form={form}
        lang={lang}
        t={t}
        parentPickerOptions={parentPickerOptions}
        isSaving={create.isPending || update.isPending}
        onClose={resetForm}
        onSubmit={handleSave}
        onFieldChange={handleFieldChange}
        onParentChange={handleParentChange}
      />
      <SmartTable
        columns={columns}
        data={rows}
        total={rows.length}
        page={1}
        pageSize={50}
        showRowNumbers
        isLoading={isLoading}
        emptyMessage={t('noCategories')}
        tableMinWidth={920}
      />
    </div>
  );
});

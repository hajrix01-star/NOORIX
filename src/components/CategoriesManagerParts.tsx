import type { ChangeEvent, FormEvent } from 'react';
import { AdaptiveSheet, Button, FormRow, Input, SearchableOptionsPicker } from '../ui';

export const TYPE_MAP = {
  purchase: { labelKey: 'categoryTypes' },
  expense: { labelKey: 'categoryTypeExpense' },
  sale: { labelKey: 'categoryTypeSale' },
} as const;

export const TYPE_BADGE_COLOR: Record<string, 'blue' | 'amber' | 'green' | 'gray'> = {
  purchase: 'blue',
  expense: 'amber',
  sale: 'green',
};

export type CategoryKind = keyof typeof TYPE_MAP;

export type CategoryNode = {
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

export type CategoryRow = CategoryNode & {
  _level: number;
  _parentName?: string;
  _parentCode?: string;
};

export type CategoryFormState = {
  nameAr: string;
  nameEn: string;
  type: CategoryKind;
  icon: string;
  parentId: string;
};

type TranslationFn = (key: string, ...args: unknown[]) => string;

type CategoryParentOption = {
  value: string;
  label: string;
};

export function CodeBadge({ row }: { row: CategoryRow }) {
  const displayCode = row.code || row.account?.code || null;
  if (!displayCode) return <span className="text-noorix-muted text-[11px]">-</span>;

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

type CategoriesManagerFormProps = {
  open: boolean;
  editing: CategoryRow | null;
  form: CategoryFormState;
  lang: string;
  t: TranslationFn;
  parentPickerOptions: CategoryParentOption[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFieldChange: <K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) => void;
  onParentChange: (parentId: string) => void;
};

export function CategoriesManagerForm({
  open,
  editing,
  form,
  lang,
  t,
  parentPickerOptions,
  isSaving,
  onClose,
  onSubmit,
  onFieldChange,
  onParentChange,
}: CategoriesManagerFormProps) {
  return (
    <AdaptiveSheet
      open={open}
      onClose={onClose}
      title={editing ? t('editCategory') : t('newCategory')}
      size="md"
      side="start"
      className="category-form-drawer"
    >
      <form onSubmit={onSubmit}>
        <FormRow cols={2} className="mb-3.5">
          <Input
            type="text"
            label={`${t('nameAr')} *`}
            value={form.nameAr}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onFieldChange('nameAr', event.target.value)}
          />
          <Input
            type="text"
            label={t('nameEnCol')}
            value={form.nameEn}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onFieldChange('nameEn', event.target.value)}
          />
          <Input
            type="select"
            label={t('type')}
            value={form.type}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => onFieldChange('type', event.target.value as CategoryKind)}
          >
            <option value="purchase">{t('categoryTypes')}</option>
            <option value="expense">{t('categoryTypeExpense')}</option>
            <option value="sale">{t('categoryTypeSale')}</option>
          </Input>
          <Input
            type="text"
            label={t('icon')}
            value={form.icon}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onFieldChange('icon', event.target.value)}
            placeholder=""
          />
        </FormRow>
        <div className="mb-[14px]">
          <SearchableOptionsPicker
            label={t('parentCategory')}
            allowEmpty
            emptyValue=""
            emptyLabel={lang === 'en' ? '- Main category -' : '- تصنيف رئيسي -'}
            value={form.parentId}
            onChange={onParentChange}
            options={parentPickerOptions}
            aria-label={t('parentCategory')}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={isSaving} loading={isSaving}>
            {isSaving ? t('saving') : t('save')}
          </Button>
          <Button type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </form>
    </AdaptiveSheet>
  );
}

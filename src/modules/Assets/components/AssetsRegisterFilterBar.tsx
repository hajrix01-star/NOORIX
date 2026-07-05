import React from 'react';
import { Button, FilterToolbar, Input, SearchableOptionsPicker } from '../../../ui';

export type AssetsRegisterFilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchApplied: () => void;
  warrantyFilter: string;
  onWarrantyFilterChange: (value: string) => void;
  onRefresh: () => void;
  t: (k: string) => string;
};

export function AssetsRegisterFilterBar({
  search,
  onSearchChange,
  onSearchApplied,
  warrantyFilter,
  onWarrantyFilterChange,
  onRefresh,
  t,
}: AssetsRegisterFilterBarProps) {
  return (
    <FilterToolbar
      filtersClassName="gap-2"
      actions={(
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          {t('refresh')}
        </Button>
      )}
    >
      <Input
        type="search"
        size="sm"
        className="max-w-md"
        value={search}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          onSearchChange(e.target.value);
          onSearchApplied();
        }}
        placeholder={t('search')}
      />
      <div className="w-full min-w-0 sm:w-[220px]">
        <SearchableOptionsPicker
          size="sm"
          value={warrantyFilter}
          onChange={(value) => {
            onWarrantyFilterChange(value);
            onSearchApplied();
          }}
          options={[
            { value: 'all', label: t('warrantyFilterAll') },
            { value: 'active', label: t('warrantyFilterActive') },
            { value: 'expiring90', label: t('warrantyFilterExpiring90') },
            { value: 'expired', label: t('warrantyFilterExpired') },
            { value: 'none', label: t('warrantyFilterNone') },
          ]}
          aria-label={t('warrantyFilterAll')}
        />
      </div>
    </FilterToolbar>
  );
}

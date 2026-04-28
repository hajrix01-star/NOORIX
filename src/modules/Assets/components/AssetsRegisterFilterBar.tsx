import React from 'react';
import { Button, Input } from '../../../ui';

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
    <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:items-center">
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
      <Input
        type="select"
        size="sm"
        className="w-full sm:w-[220px]"
        value={warrantyFilter}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
          onWarrantyFilterChange(e.target.value);
          onSearchApplied();
        }}
      >
        <option value="all">{t('warrantyFilterAll')}</option>
        <option value="active">{t('warrantyFilterActive')}</option>
        <option value="expiring90">{t('warrantyFilterExpiring90')}</option>
        <option value="expired">{t('warrantyFilterExpired')}</option>
        <option value="none">{t('warrantyFilterNone')}</option>
      </Input>
      <Button size="sm" variant="ghost" onClick={onRefresh}>
        {t('refresh')}
      </Button>
    </div>
  );
}

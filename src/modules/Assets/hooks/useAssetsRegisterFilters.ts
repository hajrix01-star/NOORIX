import { useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

export const ASSETS_REGISTER_PAGE_SIZE = 50;

export function useAssetsRegisterFilters() {
  const [warrantyFilter, setWarrantyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedQ = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);

  return {
    warrantyFilter,
    setWarrantyFilter,
    search,
    setSearch,
    debouncedQ,
    page,
    setPage,
    pageSize: ASSETS_REGISTER_PAGE_SIZE,
  };
}

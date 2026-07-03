import { memo, useCallback } from 'react';
import Button from '../Button';

export type SmartTablePaginationProps = {
  page: number;
  totalPages: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  firstPage: number;
  previousPage: number;
  nextPage: number;
  lastPage: number;
  onPageChange: (p: number) => void;
  t: (key: string, ...args: unknown[]) => string;
};

const SmartTablePagination = memo(function SmartTablePagination({
  page,
  totalPages,
  canPreviousPage,
  canNextPage,
  firstPage,
  previousPage,
  nextPage,
  lastPage,
  onPageChange,
  t,
}: SmartTablePaginationProps) {
  const go = useCallback(
    (p: number) => {
      if (p >= 1 && p <= totalPages) onPageChange(p);
    },
    [totalPages, onPageChange],
  );

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-noorix-border">
      <Button size="sm" onClick={() => go(firstPage)} disabled={!canPreviousPage}>«</Button>
      <Button size="sm" onClick={() => go(previousPage)} disabled={!canPreviousPage}>‹</Button>
      <span className="text-[13px] text-noorix-muted font-medium px-2">
        {t('pageLabel', page, totalPages)}
      </span>
      <Button size="sm" onClick={() => go(nextPage)} disabled={!canNextPage}>›</Button>
      <Button size="sm" onClick={() => go(lastPage)} disabled={!canNextPage}>»</Button>
    </div>
  );
});

export default SmartTablePagination;

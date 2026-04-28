import React from 'react';
import { Button } from '../../../../ui';
import DateFilterBar from '../../../../shared/components/DateFilterBar';

export interface PurchasesBatchFiltersProps {
  dateFilter: any;
  showCancelledBatches: boolean;
  onToggleCancelled: () => void;
  t: (key: string, ...args: any[]) => string;
}

export default function PurchasesBatchFilters(props: PurchasesBatchFiltersProps) {
  const { dateFilter, showCancelledBatches, onToggleCancelled, t } = props;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between min-w-0">
      <div className="min-w-0 flex-1">
        <DateFilterBar filter={dateFilter} />
      </div>
      <Button
        type="button"
        size="sm"
        variant={showCancelledBatches ? 'primary' : 'ghost'}
        aria-pressed={showCancelledBatches}
        onClick={onToggleCancelled}
        className="shrink-0"
      >
        {showCancelledBatches ? t('hideCancelledBatches') : t('showCancelledBatches')}
      </Button>
    </div>
  );
}

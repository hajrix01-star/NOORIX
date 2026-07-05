import React from 'react';
import { Button } from '../../../../ui';
import { DateFilterBar } from '../../../../ui/date';
import { FilterToolbar } from '../../../../ui';

export interface PurchasesBatchFiltersProps {
  dateFilter: any;
  showCancelledBatches: boolean;
  onToggleCancelled: () => void;
  t: (key: string, ...args: any[]) => string;
}

export default function PurchasesBatchFilters(props: PurchasesBatchFiltersProps) {
  const { dateFilter, showCancelledBatches, onToggleCancelled, t } = props;
  return (
    <FilterToolbar
      actions={(
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
      )}
    >
      <DateFilterBar filter={dateFilter} />
    </FilterToolbar>
  );
}
